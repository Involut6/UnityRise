import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { signatureValid, toKobo } from '../src/common/payment-utils';
import { sniffFile } from '../src/common/files';
import { loadConfig } from '../src/common/config';

describe('webhook signatures', () => {
  const raw = Buffer.from('{"data":{"reference":"x"}}');
  const good = createHmac('sha512', 's3cret').update(raw).digest('hex');
  it('accepts a valid Paystack HMAC', () => expect(signatureValid('paystack', 's3cret', raw, good)).toBe(true));
  it('rejects a tampered body', () => expect(signatureValid('paystack', 's3cret', Buffer.from('{}'), good)).toBe(false));
  it('rejects when secret or signature is missing', () => {
    expect(signatureValid('paystack', undefined, raw, good)).toBe(false);
    expect(signatureValid('paystack', 's3cret', raw, undefined)).toBe(false);
  });
  it('compares Flutterwave secret hash', () => {
    expect(signatureValid('flutterwave', 'hash', raw, 'hash')).toBe(true);
    expect(signatureValid('flutterwave', 'hash', raw, 'other')).toBe(false);
  });
});

describe('toKobo', () => {
  it('treats Paystack amounts as kobo and Flutterwave as naira', () => {
    expect(toKobo('paystack', 500000)).toBe(500000);
    expect(toKobo('flutterwave', 5000.1)).toBe(500010);
  });
  it('rejects missing / non-positive amounts', () => {
    for (const v of [undefined, null, 0, -5, 'abc']) expect(toKobo('paystack', v)).toBeUndefined();
  });
});

describe('sniffFile', () => {
  it('detects JPEG, PNG, PDF by magic bytes', () => {
    expect(sniffFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(sniffFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    expect(sniffFile(Buffer.from('%PDF-1.7'))?.ext).toBe('pdf');
  });
  it('rejects executables and text', () => {
    expect(sniffFile(Buffer.from('MZ\x90\x00'))).toBeUndefined();
    expect(sniffFile(Buffer.from('<script>'))).toBeUndefined();
  });
});

describe('loadConfig', () => {
  const ok = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'a'.repeat(32) };
  it('loads valid config with defaults', () => expect(loadConfig(ok).port).toBe(3000));
  it('fails fast listing every problem', () => {
    expect(() => loadConfig({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET must be at least 32[\s\S]*DATABASE_URL is required/);
  });
  it('rejects wildcard CORS in production', () => {
    expect(() => loadConfig({ ...ok, NODE_ENV: 'production', CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
  });
});
