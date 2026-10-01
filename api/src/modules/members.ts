import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, ForbiddenException, StreamableFile, Res } from '@nestjs/common';
import { MAX_FILE, sniffFile } from '../common/files';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Roles, STAFF } from '../common/auth';
import { KycDocDto, KycDto, ReviewDto } from '../common/dto';
import { notify } from '../common/ledger';

const REQUIRED_DOCS = ['photo', 'id_card', 'signature', 'proof_of_address'];

@Injectable()
export class MembersService {
  constructor(private db: Db) {}
  private mid(u: AuthUser) { if (!u.memberId) throw new ForbiddenException('Not a member account'); return u.memberId; }
  async saveKyc(u: AuthUser, d: KycDto) {
    const m = await this.db.one('select kyc_status from members where id=$1', [this.mid(u)]);
    if (!['draft', 'rejected'].includes(m.kyc_status)) throw new BadRequestException('KYC already submitted');
    await this.db.q('update members set date_of_birth=$2,bvn=$3,nin=$4,address=$5 where id=$1', [u.memberId, d.dateOfBirth, d.bvn, d.nin, d.address]);
    return { saved: true };
  }
  async upload(u: AuthUser, d: KycDocDto) {
    const buf = Buffer.from(d.contentBase64, 'base64');
    if (!buf.length || buf.length > MAX_FILE) throw new BadRequestException(`File must be 1B–${MAX_FILE / 1024 / 1024}MB`);
    const type = sniffFile(buf);
    if (!type) throw new BadRequestException('Only JPEG, PNG or PDF files are accepted');
    await this.db.tx(async q => {
      await q('delete from kyc_documents where member_id=$1 and kind=$2', [u.memberId, d.kind]);
      await q('insert into kyc_documents(member_id,kind,filename,content,mime) values($1,$2,$3,$4,$5)', [u.memberId, d.kind, d.filename.slice(0, 200), buf, type.mime]);
    });
    return { uploaded: d.kind };
  }
  async submit(u: AuthUser) {
    const id = this.mid(u);
    const m = await this.db.one('select * from members where id=$1', [id]);
    if (!m.bvn || !m.nin || !m.address || !m.date_of_birth) throw new BadRequestException('Complete personal details first');
    const docs = (await this.db.q('select kind from kyc_documents where member_id=$1', [id])).map(r => r.kind);
    const missing = REQUIRED_DOCS.filter(k => !docs.includes(k));
    if (missing.length) throw new BadRequestException(`Missing documents: ${missing.join(', ')}`);
    await this.db.q("update members set kyc_status='submitted',kyc_note=null where id=$1 and kyc_status in ('draft','rejected')", [id]);
    return { status: 'submitted' };
  }
  list(status?: string, q?: string) {
    return this.db.q(`select m.id,m.membership_id,m.first_name,m.last_name,m.kyc_status,m.created_at,u.email,u.phone,u.is_active,
        coalesce((select sum(direction*amount) from transactions t where t.member_id=m.id and t.affects_savings),0) savings,
        (select status from loans l where l.member_id=m.id order by created_at desc limit 1) loan_status
      from members m join users u on u.id=m.user_id
      where ($1::text is null or m.kyc_status::text=$1)
        and ($2::text is null or (m.first_name||' '||m.last_name||' '||coalesce(m.membership_id,'')||' '||u.email) ilike '%'||$2||'%')
      order by m.created_at desc limit 500`, [status ?? null, q ?? null]);
  }
  /** Lets a member find a guarantor by Membership ID without exposing more than a short display name. */
  async lookup(u: AuthUser, mid: string) {
    const m = await this.db.one("select id,first_name,last_name from members where membership_id=$1 and kyc_status='approved' and id<>$2", [mid.toUpperCase(), u.memberId]);
    if (!m) throw new NotFoundException('No approved member with that ID');
    return { name: `${m.first_name} ${m.last_name[0]}.` };
  }
  async full(id: string) {
    const m = await this.detail(id);
    const savings = (await this.db.one('select coalesce(sum(direction*amount),0) b from transactions where member_id=$1 and affects_savings', [id])).b;
    return {
      ...m, savings: Number(savings),
      transactions: await this.db.q('select id,type,amount,direction,reference,narration,created_at from transactions where member_id=$1 order by created_at desc limit 100', [id]),
      loans: await this.db.q('select id,product_code,principal,tenor_months,status,created_at from loans where member_id=$1 order by created_at desc', [id]),
      investments: await this.db.q('select x.amount,x.payout,x.created_at,s.title,s.status from investment_subscriptions x join investment_schemes s on s.id=x.scheme_id where x.member_id=$1 order by x.created_at desc', [id]),
      audit: await this.db.q(`select a.id,a.action,a.created_at,u.email actor from audit_logs a left join users u on u.id=a.actor_id where a.entity=$1 order by a.id desc limit 50`, [id]),
      reviewer: m.reviewed_by ? (await this.db.one('select email from users where id=$1', [m.reviewed_by]))?.email : null,
    };
  }
  async file(memberId: string, docId: string) {
    const d = await this.db.one('select filename,content,mime from kyc_documents where id=$1 and member_id=$2', [docId, memberId]);
    if (!d?.content) throw new NotFoundException();
    return { buffer: d.content as Buffer, type: d.mime ?? 'application/octet-stream', name: d.filename };
  }
  async detail(id: string) {
    const m = await this.db.one(`select m.*, u.email, u.phone, u.is_active from members m join users u on u.id=m.user_id where m.id=$1`, [id]);
    if (!m) throw new NotFoundException();
    m.bvn = m.bvn && `*******${m.bvn.slice(-4)}`; m.nin = m.nin && `*******${m.nin.slice(-4)}`; // mask PII in API output
    m.documents = await this.db.q('select id,kind,filename,created_at from kyc_documents where member_id=$1', [id]);
    return m;
  }
  async review(staff: AuthUser, id: string, d: ReviewDto) {
    return this.db.tx(async q => {
      const [m] = await q('select * from members where id=$1 for update', [id]);
      if (!m) throw new NotFoundException();
      if (m.kyc_status !== 'submitted') throw new BadRequestException('Member KYC is not awaiting review');
      if (d.decision === 'reject') {
        if (!d.note) throw new BadRequestException('A reason is required');
        await q("update members set kyc_status='rejected',kyc_note=$2,reviewed_by=$3 where id=$1", [id, d.note, staff.id]);
        await notify(q, id, 'KYC rejected', d.note);
        return { status: 'rejected' };
      }
      const [{ n }] = await q("select nextval('membership_seq') n");
      const mid = `UR-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
      await q("update members set kyc_status='approved',membership_id=$2,reviewed_by=$3,approved_at=now() where id=$1", [id, mid, staff.id]);
      await q('insert into wallets(member_id) values($1) on conflict do nothing', [id]);
      await notify(q, id, 'Welcome to UnityRise', `Your membership has been approved. Membership ID: ${mid}`);
      return { status: 'approved', membershipId: mid };
    });
  }
}
@Controller('members')
export class MembersController {
  constructor(private s: MembersService) {}
  @Put('me/kyc') save(@CurrentUser() u: AuthUser, @Body() d: KycDto) { return this.s.saveKyc(u, d); }
  @Post('me/kyc/documents') up(@CurrentUser() u: AuthUser, @Body() d: KycDocDto) { return this.s.upload(u, d); }
  @Post('me/kyc/submit') sub(@CurrentUser() u: AuthUser) { return this.s.submit(u); }
  @Get('lookup/:mid') lookup(@CurrentUser() u: AuthUser, @Param('mid') mid: string) { return this.s.lookup(u, mid); }
  @Roles(...STAFF) @Get() list(@Query('status') s?: string, @Query('q') q?: string) { return this.s.list(s, q); }
  @Roles(...STAFF) @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.s.detail(id); }
  @Roles(...STAFF) @Get(':id/full') full(@Param('id', ParseUUIDPipe) id: string) { return this.s.full(id); }
  @Roles(...STAFF) @Get(':id/documents/:docId/file')
  async file(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @Res({ passthrough: true }) res: any) {
    const f = await this.s.file(id, docId);
    res.set({ 'Content-Type': f.type, 'Content-Disposition': `inline; filename="${encodeURIComponent(f.name)}"`, 'Cache-Control': 'private, no-store' });
    return new StreamableFile(f.buffer);
  }
  @Roles('admin') @Post(':id/review') review(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: ReviewDto) { return this.s.review(u, id, d); }
}
@Module({ providers: [MembersService], controllers: [MembersController] }) export class MembersModule {}
