import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app.factory.js';

/**
 * Vercel (serverless) entry. The Nest app is created once per warm instance and reused.
 * The raw request body is read here (before anything else touches the stream) so that:
 *  - Express's JSON parser is skipped (we hand it a parsed `req.body`, with `_body` set), and
 *  - webhook signature checks still get the exact bytes via `req.rawBody`.
 */
let ready: Promise<(req: IncomingMessage, res: ServerResponse) => void> | undefined;
const boot = () => (ready ??= createApp({ serveWeb: false }).then(async app => { await app.init(); return app.getHttpAdapter().getInstance(); }).catch(e => { ready = undefined; throw e; }));

async function readRaw(req: IncomingMessage & { body?: unknown; readableEnded?: boolean }): Promise<Buffer> {
  if (req.readableEnded && req.body !== undefined) { // platform already consumed the stream
    return Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  }
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage & Record<string, any>, res: ServerResponse) {
  try {
    const app = await boot();
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const raw = await readRaw(req); req.rawBody = raw; req._body = true;
      if (raw.length && String(req.headers['content-type'] ?? '').includes('json')) {
        try { req.body = JSON.parse(raw.toString('utf8')); }
        catch { res.statusCode = 400; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ statusCode: 400, message: 'Invalid JSON body' })); return; }
      } else req.body = {};
    }
    app(req, res);
  } catch (e: any) {
    console.error('boot/handler failure', e?.message);
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type, authorization'); // let the browser show this message
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    res.statusCode = 500; res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ statusCode: 500, message: 'Server failed to start. Check the deployment logs and environment variables.' }));
  }
}
