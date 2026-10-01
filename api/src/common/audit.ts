import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { Db } from './db';

/** Audit trail: every successful state-changing request is recorded with actor, route and sanitised body. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private db: Db) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    if (req.method === 'GET') return next.handle();
    return next.handle().pipe(tap(() => {
      const { password, code, token, ...body } = req.body ?? {};
      this.db.q('insert into audit_logs(actor_id,action,entity,detail,ip) values($1,$2,$3,$4,$5)',
        [req.user?.id ?? null, `${req.method} ${req.route?.path ?? req.url}`, req.params?.id ?? null, JSON.stringify({ params: req.params, body }), req.ip]).catch(() => {});
    }));
  }
}
