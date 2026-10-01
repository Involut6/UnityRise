# UnityRise CoopManager

Web-first cooperative management platform (see *UnityRise Engineers Proposal*). NestJS API + React web app + PostgreSQL.

```
api/   NestJS (TypeScript) – modular monolith, raw SQL via pg, JWT auth + RBAC + audit trail
web/   React 18 + Vite + TypeScript – member portal and staff/admin dashboard
```

## Run

```bash
cd api && cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, ADMIN_*
npm i && npm run migrate && npm run seed && npm run build
npm start                                  # API on :3000 (loads .env)
cd ../web && npm i && npm run build      # API serves web/dist; or `npm run dev` for :5173
node api/test/smoke.js                   # end-to-end test against a running API
```

## Implemented
Registration + KYC workflow (UR-YYYY-XXXXX IDs), TOTP 2FA, RBAC (member / loan_officer / accountant / admin / super_admin),
savings wallet on an immutable ledger, Paystack/Flutterwave payment flow with verified webhooks + idempotent settlement,
6 loan products (eligibility vs savings, 2 guarantor consents, 2-approver sign-off, schedule generation, repayments, penalties, reminders),
investment schemes (maker-checker approval, subscriptions, maturity payout), announcements/notifications, polls & resolutions
(one-member-one-vote), meetings/QR-style check-in/minutes search, reports (JSON + CSV), audit log.

## Not yet done / needs credentials
- Live gateway SDK calls (Paystack/Flutterwave/NIBSS), BVN/NIN verification API, SMS (Termii), email (SendGrid), FCM push — adapters are stubbed.
- PDF exports, mobile apps (phase 2), S3 storage (KYC files currently on local disk), Redis/Mongo (not needed yet; audit logs live in Postgres).
- Scheduled jobs: `POST /api/loans/jobs/penalties` and `/jobs/reminders` must be triggered daily by a cron.
- Interest accrual on savings, liveness check, dividends report, CAC templates.
