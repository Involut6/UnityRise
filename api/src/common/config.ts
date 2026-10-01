/** Typed, validated configuration. Loaded once at startup; fails fast on missing/invalid values. */
export interface Config {
  env: 'development' | 'test' | 'staging' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  uploadDir: string;
  paystackWebhookSecret?: string;
  flutterwaveWebhookSecret?: string;
  login: { maxFailures: number; lockMinutes: number };
}

export function loadConfig(e: NodeJS.ProcessEnv = process.env): Config {
  const errors: string[] = [];
  const need = (k: string) => { const v = e[k]; if (!v) errors.push(`${k} is required`); return v ?? ''; };
  const int = (k: string, d: number) => {
    const v = e[k] === undefined ? d : Number(e[k]);
    if (!Number.isInteger(v) || v <= 0) errors.push(`${k} must be a positive integer`);
    return v;
  };
  const env = (e.NODE_ENV ?? 'development') as Config['env'];
  if (!['development', 'test', 'staging', 'production'].includes(env)) errors.push('NODE_ENV must be development|test|staging|production');
  const jwtSecret = need('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) errors.push('JWT_SECRET must be at least 32 characters');
  const cfg: Config = {
    env,
    port: int('PORT', 3000),
    databaseUrl: need('DATABASE_URL'),
    jwtSecret,
    corsOrigins: (e.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
    uploadDir: e.UPLOAD_DIR ?? 'uploads',
    paystackWebhookSecret: e.PAYSTACK_WEBHOOK_SECRET || undefined,
    flutterwaveWebhookSecret: e.FLUTTERWAVE_WEBHOOK_SECRET || undefined,
    login: { maxFailures: int('LOGIN_MAX_FAILURES', 5), lockMinutes: int('LOGIN_LOCK_MINUTES', 15) },
  };
  if (env === 'production' && cfg.corsOrigins.some(o => o === '*')) errors.push('CORS_ORIGIN must not be * in production');
  if (errors.length) throw new Error(`Invalid configuration:\n - ${errors.join('\n - ')}`);
  return cfg;
}

let cached: Config | undefined;
export const config = (): Config => (cached ??= loadConfig());
