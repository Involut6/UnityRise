import { Logger, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { Db } from './db.js';
import { clientIp } from './ip.js';

/** Audit trail: every successful state-changing request is recorded with actor, route and sanitised body. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private log = new Logger('audit');
  constructor(private db: Db) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    if (req.method === 'GET') return next.handle();
    return next.handle().pipe(tap(() => {
      const { password, code, token, contentBase64, ...body } = req.body ?? {};
      this.db.q('insert into audit_logs(actor_id,action,entity,detail,ip,request_id) values($1,$2,$3,$4,$5,$6)',
        [req.user?.id ?? null, `${req.method} ${req.route?.path ?? req.url}`, req.params?.id ?? null, JSON.stringify({ params: req.params, body }), clientIp(req), req.id ?? null])
        .catch((e: Error) => this.log.error(`audit write failed: ${e.message}`));
    }));
  }
}
