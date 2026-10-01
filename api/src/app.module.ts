import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { config } from './common/config.js';
import { DbModule } from './common/db.js';
import { AuthGuard } from './common/auth.js';
import { AuditInterceptor } from './common/audit.js';
import { AuthModule } from './modules/auth.js';
import { MembersModule } from './modules/members.js';
import { SavingsModule } from './modules/savings.js';
import { LoansModule } from './modules/loans.js';
import { InvestmentsModule } from './modules/investments.js';
import { CommunityModule } from './modules/community.js';
import { ReportsModule } from './modules/reports.js';
import { AdminModule } from './modules/admin.js';
import { OpsModule } from './modules/ops.js';

@Module({
  imports: [
    DbModule,
    JwtModule.register({ global: true, secret: config().jwtSecret, signOptions: { expiresIn: '30m' } }),
    AuthModule, MembersModule, SavingsModule, LoansModule, InvestmentsModule, CommunityModule, ReportsModule, AdminModule, OpsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
