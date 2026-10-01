import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const log = new Logger('http');

/** Attaches a request ID (honouring a sane inbound X-Request-Id) and logs one structured line per request. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header('x-request-id');
  const id = inbound && /^[\w-]{8,64}$/.test(inbound) ? inbound : randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('x-request-id', id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = JSON.stringify({ requestId: id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(ms), ip: req.ip });
    if (res.statusCode >= 500) log.error(line); else if (res.statusCode >= 400) log.warn(line); else log.log(line);
  });
  next();
}

/** Keeps Nest's `{ statusCode, message }` shape (the web app reads `message`) but never leaks internals on 5xx. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request & { id?: string }>();
    if (e instanceof HttpException) {
      const body = e.getResponse();
      res.status(e.getStatus()).json(typeof body === 'string' ? { statusCode: e.getStatus(), message: body } : body);
      return;
    }
    log.error(JSON.stringify({ requestId: req.id, error: e instanceof Error ? e.stack : String(e) }));
    // TEMPORARY DIAGNOSTICS: with DEBUG_ERRORS=true the response also carries the error name/code/message (no stack).
    // Turn it on only while debugging a deployment and remove it afterwards.
    const detail = process.env.DEBUG_ERRORS === 'true' && e instanceof Error
      ? { name: e.name, code: (e as { code?: unknown }).code, message: e.message.slice(0, 300) } : undefined;
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error', requestId: req.id, ...(detail && { detail }) });
  }
}
