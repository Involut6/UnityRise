import { BadRequestException, Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Roles } from '../common/auth';

class RoleDto { @IsIn(['member', 'loan_officer', 'accountant', 'admin']) role: string }

@Controller('admin')
export class AdminController {
  constructor(private db: Db) {}
  @Roles('admin') @Get('audit') audit(@Query('limit') l?: string) {
    return this.db.q(`select a.*,u.email actor from audit_logs a left join users u on u.id=a.actor_id order by a.id desc limit $1`, [Math.min(Number(l) || 100, 500)]);
  }
  @Roles('super_admin') @Get('users') users() { return this.db.q('select id,email,role,is_active,created_at from users order by created_at desc limit 200'); }
  @Roles('super_admin') @Put('users/:id/role')
  async role(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: RoleDto) {
    if (id === me.id) throw new BadRequestException('You cannot change your own role');
    await this.db.q("update users set role=$2 where id=$1 and role<>'super_admin'", [id, d.role]);
    return { ok: true };
  }
}
@Module({ controllers: [AdminController] }) export class AdminModule {}
