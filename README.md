# UnityRise CoopManager

Web-first cooperative management platform (see *UnityRise Engineers Proposal*). NestJS API + React web app + PostgreSQL.

```
api/   NestJS (TypeScript) – modular monolith, raw SQL via pg, JWT auth + RBAC + audit trail
web/   React 19 + Vite + TypeScript + Tailwind CSS v4 – member portal and staff/admin app
       src/components/ui (design system) · layout (shell/nav) · features · pages/member · pages/admin
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

## Frontend notes
- Routes: member portal at `/`, admin at `/admin` (staff who are also members switch via the top bar). Every page is lazy-loaded; charts load on demand.
- Design tokens live in `web/src/index.css` (semantic colours switch automatically for dark mode). Reusable pieces: `Button, Card, StatusBadge, Alert, DataTable, Tabs, Modal, Drawer, useConfirm, useToast, FormField, FileUpload, StatCard, FinancialCard, ChartCard, TransactionTable`.
- Session timeout: 15 minutes idle → 60 s warning → sign out. "Stay signed in" refreshes the token (`POST /api/auth/refresh`).
- "Export Excel" downloads CSV (opens in Excel). "Export PDF" uses the browser print dialog → Save as PDF.
- Test flows: `node api/test/smoke.js` (API) and the Playwright script described in the PR/commit for UI.
