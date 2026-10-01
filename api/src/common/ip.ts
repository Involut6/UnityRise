import type { IncomingMessage } from 'http';

/**
 * Best-effort client IP that never throws. Express's `req.ip` reads the TCP socket, which does not exist on
 * serverless platforms (Vercel hands over a request with a null socket), so we read the proxy headers first.
 * On Vercel the platform overwrites X-Forwarded-For / X-Real-IP with the real client address, so they are trustworthy
 * there; elsewhere we fall back to Express's own trust-proxy logic.
 */
export function clientIp(req: IncomingMessage & { ip?: string }): string | undefined {
  const header = (n: string) => { const v = req.headers[n]; return (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim() || undefined; };
  if (process.env.VERCEL) { const h = header('x-real-ip') ?? header('x-forwarded-for'); if (h) return h; }
  try { if (req.ip) return req.ip; } catch { /* no socket */ }
  return header('x-forwarded-for') ?? req.socket?.remoteAddress ?? undefined;
}
