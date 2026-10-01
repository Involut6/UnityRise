import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Roles, STAFF } from '../common/auth';
import { AnnounceDto, MeetingDto, MinutesDto, PollDto, VoteDto } from '../common/dto';

@Injectable()
export class CommunityService {
  constructor(private db: Db) {}
  private mid(u: AuthUser) { if (!u.memberId) throw new ForbiddenException(); return u.memberId; }
  private async approvedMember(u: AuthUser) {
    const m = await this.db.one('select kyc_status from members where id=$1', [this.mid(u)]);
    if (m.kyc_status !== 'approved') throw new ForbiddenException('Only approved members may participate');
  }
  async announce(u: AuthUser, d: AnnounceDto) {
    return this.db.tx(async q => {
      const [a] = await q('insert into announcements(title,body,kind,created_by) values($1,$2,$3,$4) returning *', [d.title, d.body, d.kind, u.id]);
      await q("insert into notifications(member_id,title,body) select id,$1,$2 from members where kyc_status='approved'", [d.title, d.body]);
      return a;
    });
  }
  announcements() { return this.db.q('select * from announcements order by created_at desc limit 50'); }
  inbox(u: AuthUser) { return this.db.q('select * from notifications where member_id=$1 order by created_at desc limit 100', [this.mid(u)]); }
  async markRead(u: AuthUser, id: string) { await this.db.q('update notifications set read_at=now() where id=$1 and member_id=$2 and read_at is null', [id, this.mid(u)]); return { ok: true }; }

  createPoll(u: AuthUser, d: PollDto) {
    if (new Date(d.closesAt) <= new Date()) throw new BadRequestException('closesAt must be in the future');
    return this.db.one('insert into polls(question,options,is_resolution,closes_at,created_by) values($1,$2,$3,$4,$5) returning *', [d.question, JSON.stringify(d.options), !!d.isResolution, d.closesAt, u.id]);
  }
  async polls(u: AuthUser) {
    return this.db.q(`select p.*, (p.closes_at > now()) open,
      (select option_index from votes v where v.poll_id=p.id and v.member_id=$1) my_vote,
      (select coalesce(jsonb_object_agg(option_index, c),'{}') from (select option_index, count(*) c from votes where poll_id=p.id group by 1) t) tally
      from polls p order by created_at desc limit 50`, [u.memberId]);
  }
  async vote(u: AuthUser, id: string, d: VoteDto) {
    await this.approvedMember(u);
    const p = await this.db.one('select options,closes_at from polls where id=$1', [id]);
    if (!p) throw new NotFoundException();
    if (new Date(p.closes_at) <= new Date()) throw new BadRequestException('Voting closed');
    if (d.optionIndex >= p.options.length) throw new BadRequestException('Invalid option');
    // One-member-one-vote is enforced by the (poll_id, member_id) primary key.
    try { await this.db.q('insert into votes(poll_id,member_id,option_index) values($1,$2,$3)', [id, u.memberId, d.optionIndex]); }
    catch (e: any) { if (e.code === '23505') throw new BadRequestException('You have already voted'); throw e; }
    return { voted: true };
  }
  createMeeting(u: AuthUser, d: MeetingDto) { return this.db.one('insert into meetings(title,held_at,venue,created_by) values($1,$2,$3,$4) returning *', [d.title, d.heldAt, d.venue ?? null, u.id]); }
  meetings(q?: string) { return this.db.q(`select m.*,(select count(*) from meeting_attendance a where a.meeting_id=m.id) attendees from meetings m
    where ($1::text is null or m.title ilike '%'||$1||'%' or m.minutes ilike '%'||$1||'%') order by held_at desc limit 50`, [q ?? null]); }
  async setMinutes(id: string, d: MinutesDto) { await this.db.q('update meetings set minutes=$2 where id=$1', [id, d.minutes]); return { ok: true }; }
  async checkIn(u: AuthUser, id: string) {
    await this.approvedMember(u);
    const m = await this.db.one('select held_at from meetings where id=$1', [id]);
    if (!m) throw new NotFoundException();
    const hrs = Math.abs(Date.now() - new Date(m.held_at).getTime()) / 36e5;
    if (hrs > 12) throw new BadRequestException('Check-in is only open around the meeting time');
    await this.db.q('insert into meeting_attendance(meeting_id,member_id) values($1,$2) on conflict do nothing', [id, u.memberId]);
    return { checkedIn: true };
  }
}
@Controller()
export class CommunityController {
  constructor(private s: CommunityService) {}
  @Roles('admin') @Post('announcements') ann(@CurrentUser() u: AuthUser, @Body() d: AnnounceDto) { return this.s.announce(u, d); }
  @Get('announcements') anns() { return this.s.announcements(); }
  @Get('notifications') inbox(@CurrentUser() u: AuthUser) { return this.s.inbox(u); }
  @Post('notifications/:id/read') read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.markRead(u, id); }
  @Roles('admin') @Post('polls') mkPoll(@CurrentUser() u: AuthUser, @Body() d: PollDto) { return this.s.createPoll(u, d); }
  @Get('polls') polls(@CurrentUser() u: AuthUser) { return this.s.polls(u); }
  @Post('polls/:id/vote') vote(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: VoteDto) { return this.s.vote(u, id, d); }
  @Roles('admin') @Post('meetings') mkMeeting(@CurrentUser() u: AuthUser, @Body() d: MeetingDto) { return this.s.createMeeting(u, d); }
  @Get('meetings') meetings(@Query('q') q?: string) { return this.s.meetings(q); }
  @Roles('admin') @Post('meetings/:id/minutes') minutes(@Param('id', ParseUUIDPipe) id: string, @Body() d: MinutesDto) { return this.s.setMinutes(id, d); }
  @Post('meetings/:id/checkin') check(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.checkIn(u, id); }
}
@Module({ providers: [CommunityService], controllers: [CommunityController] }) export class CommunityModule {}
