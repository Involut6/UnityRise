# Deploying on Vercel

Two Vercel projects from this one repo: the **API** (`api/`) and the **web app** (`web/`). Database: Neon.

## 0. Database (once, from your own machine)
Vercel does not run migrations. From `api/` with your Neon **direct** connection string:
```powershell
$env:DATABASE_URL = "<neon connection string>"
npm run migrate          # applies db/001 … 005 (runs db/migrate.cjs)
$env:ADMIN_EMAIL = "you@example.com"; $env:ADMIN_PASSWORD = "<12+ chars>"
npm run seed             # creates / resets the super admin
```
Re-run `npm run migrate` after every release that adds a file under `api/db/`.

## 1. API project
New Project → import the repo → **Root Directory: `api`** → Framework Preset: **Other**. `api/vercel.json` already sets `"framework": null` (so Vercel does not switch on its built-in NestJS mode), the build command, the function and the daily cron.

Environment variables (Production):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (host contains `-pooler`) |
| `JWT_SECRET` | random, 32+ characters |
| `CORS_ORIGIN` | your web app's URL, e.g. `https://unityrise.vercel.app` (comma-separate several, no `*`) |
| `CRON_SECRET` | random string. Vercel Cron sends it automatically; it enables `/api/cron/daily` (penalties + reminders) |
| `PAYSTACK_WEBHOOK_SECRET`, `FLUTTERWAVE_WEBHOOK_SECRET` | when you add live gateways |
| `NODE_ENV` | `production` |

Check it: open `https://<your-api>.vercel.app/api/health`. You should see `{"ok":true,…}`. A 500 there with "Server failed to start" means a missing or invalid environment variable. Check **Deployments → Functions → Logs**.

## 2. Web project
New Project → same repo → **Root Directory: `web`** → Framework: Vite. Add one variable:
`VITE_API_URL = https://<your-api>.vercel.app` (no trailing slash), then redeploy. Put the web URL into the API's `CORS_ORIGIN`.

## Things to know
- **Node version:** `api/package.json` pins `22.x` (Nest 12 needs Node 20+). The API is native ES modules, so it does not rely on `require()` of ES modules (which serverless runtimes can disable).
- **Uploads** (KYC and loan documents) are stored in Postgres. Vercel rejects request bodies over 4.5MB, so files are limited to **3MB**; the web app shrinks photos automatically. PDFs over 3MB are refused.
- **Payments:** the dev-only "simulate" endpoint is disabled in production. Until live Paystack/Flutterwave integration is added, deposits stay *pending*. For a demo only, set `NODE_ENV=development` on a non-production project to enable the simulator. Never do that with real money.
- **Cold starts:** the first request after idle can take 1–3 s.
- **Cron:** the schedule is in `api/vercel.json` (06:00 UTC daily). The Hobby plan allows daily crons only.
- **Local check of the serverless handler:** `npm run build`, then `node --env-file=.env test/serverless-smoke.cjs`.

## Troubleshooting
| Symptom | Cause |
|---|---|
| 404 on every URL | Root Directory is not `api`, or `vercel.json` was not picked up |
| `No entrypoint found which imports nestjs` | Vercel auto-detected NestJS. `api/vercel.json` sets `"framework": null` to prevent it; also set Settings → Build & Development → Framework Preset to **Other** |
| `No Output Directory named "public" found` | The API is functions-only, but Vercel still wants a static folder. `api/vercel.json` sets `outputDirectory: "public"` and `api/public/index.html` exists; make sure both are deployed |
| `require() of ES Module … not supported` | You are deploying an older commit. The API is compiled as native ES modules (Nest 12 is ESM-only) and is loaded with `import()`, which works in Vercel's runtime. Deploy a branch that includes this fix |
| `Server failed to start` | Missing/invalid env var (`DATABASE_URL`, `JWT_SECRET` ≥ 32 chars, …) |
| `relation "…" does not exist` | Migrations not applied to this database |
| Browser: CORS error + **500** on the `OPTIONS` (preflight) request | The API failed to start because of a bad environment variable (for example `CORS_ORIGIN=*`, a `JWT_SECRET` under 32 characters, or a missing `DATABASE_URL`). Open `/api/health` to read the message. Never use `*` for `CORS_ORIGIN` |
| Browser: CORS error (preflight is 204 or 200) | `CORS_ORIGIN` doesn't exactly match the web URL (scheme + host, no trailing slash) |
| Browser calls `/api/...` on the web domain | `VITE_API_URL` not set at **build** time; set it and redeploy |
| 413 on upload | File over 3MB (or a very large PDF) |
| Build fails with `tsc: command not found` | `NODE_ENV=production` makes npm skip dev dependencies at install time. `api/vercel.json` uses `npm install --include=dev` to avoid this; make sure that file is deployed |
