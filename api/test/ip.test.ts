import { afterEach, describe, expect, it } from 'vitest';
import { clientIp } from '../src/common/ip';

const req = (headers: Record<string, string>, extra: object = {}) => ({ headers, ...extra }) as never;
afterEach(() => { delete process.env.VERCEL; });

describe('clientIp', () => {
  it('does not throw when there is no socket (serverless) and uses the forwarded header', () => {
    const r = { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, socket: null, get ip(): string { throw new TypeError("Cannot read properties of null (reading 'remoteAddress')"); } };
    expect(clientIp(r as never)).toBe('203.0.113.9');
  });
  it('on Vercel prefers x-real-ip, then the first x-forwarded-for entry', () => {
    process.env.VERCEL = '1';
    expect(clientIp(req({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1' }, { ip: '127.0.0.1' }))).toBe('198.51.100.7');
    expect(clientIp(req({ 'x-forwarded-for': '198.51.100.8, 10.0.0.1' }, { ip: '127.0.0.1' }))).toBe('198.51.100.8');
  });
  it('off Vercel uses Express req.ip (trust-proxy aware) and ignores spoofable headers', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6' }, { ip: '192.0.2.1' }))).toBe('192.0.2.1');
  });
  it('returns undefined rather than throwing when nothing is known', () => {
    expect(clientIp(req({}, { socket: null }))).toBeUndefined();
  });
});
