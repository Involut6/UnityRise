import { createHmac, timingSafeEqual } from 'crypto';

export type Provider = 'paystack' | 'flutterwave';
export const PROVIDERS: Provider[] = ['paystack', 'flutterwave'];

/** True when `sig` authenticates `raw` for the provider. Paystack: HMAC-SHA512 of the raw body. Flutterwave: static secret hash. */
export function signatureValid(provider: Provider, secret: string | undefined, raw: Buffer | undefined, sig: string | undefined): boolean {
  if (!secret || !raw || !sig) return false;
  const expected = provider === 'paystack' ? createHmac('sha512', secret).update(raw).digest('hex') : secret;
  const a = Buffer.from(expected), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Gateway-reported amount converted to integer kobo. Paystack reports kobo; Flutterwave reports naira. */
export function toKobo(provider: Provider, amount: unknown): number | undefined {
  const n = Number(amount);
  if (amount === undefined || amount === null || !Number.isFinite(n) || n <= 0) return undefined;
  return provider === 'paystack' ? Math.round(n) : Math.round(n * 100);
}
