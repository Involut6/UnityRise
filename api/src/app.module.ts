import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DbModule } from './common/db';
import { AuthGuard } from './common/auth';
import { AuditInterceptor } from './common/audit';
import { AuthModule } from './modules/auth';
import { MembersModule } from './modules/members';
import { SavingsModule } from './modules/savings';
import { LoansModule } from './modules/loans';
import { InvestmentsModule } from './modules/investments';
import { CommunityModule } from './modules/community';
import { ReportsModule } from './modules/reports';
import { AdminModule } from './modules/admin';

@Module({
  imports: [
    DbModule,
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: '30m' } }),
    AuthModule, MembersModule, SavingsModule, LoansModule, InvestmentsModule, CommunityModule, ReportsModule, AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
