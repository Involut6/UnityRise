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
node api/test/smoke.js                   # end-to-end test against a running API (export the .env vars first)
(cd api && npm test)                     # unit tests (vitest)
```

## Implemented
Registration + KYC workflow (UR-YYYY-XXXXX IDs), TOTP 2FA, RBAC (member / loan_manager / accountant / admin / super_admin),
savings wallet on an immutable ledger, Paystack/Flutterwave payment flow with verified webhooks + idempotent settlement,
6 interest-free loan types (limit = a multiple of the member's savings + live investments, 2 guarantor consents, one final approval by a loan manager or the super admin, equal monthly instalments, late-payment penalty, reminders),
investment schemes (maker-checker approval, subscriptions, maturity payout), announcements/notifications, polls & resolutions
(one-member-one-vote), meetings/QR-style check-in/minutes search, reports (JSON + CSV), audit log.

## Not yet done / needs credentials
- Live gateway SDK calls (Paystack/Flutterwave/NIBSS), BVN/NIN verification API, SMS (Termii), email (SendGrid), FCM push — adapters are stubbed.
- PDF exports, mobile apps (phase 2), S3 storage (KYC files currently on local disk), Redis/Mongo (not needed yet; audit logs live in Postgres).
- Scheduled jobs: `POST /api/loans/jobs/penalties` and `/jobs/reminders` must be triggered daily by a cron.
- Liveness check, dividends report, CAC templates.

See `docs/BACKEND_AUDIT.md` for the security/architecture audit, what was hardened, and the remaining gaps.
Environment variables are documented in `api/.env.example`; the API refuses to start if required config is invalid.

## Frontend notes
- Routes: member portal at `/`, admin at `/admin` (staff who are also members switch via the top bar). Every page is lazy-loaded; charts load on demand.
- Design tokens live in `web/src/index.css` (semantic colours switch automatically for dark mode). Reusable pieces: `Button, Card, StatusBadge, Alert, DataTable, Tabs, Modal, Drawer, useConfirm, useToast, FormField, FileUpload, StatCard, FinancialCard, ChartCard, TransactionTable`.
- Session timeout: 15 minutes idle → 60 s warning → sign out. "Stay signed in" refreshes the token (`POST /api/auth/refresh`).
- "Export Excel" downloads CSV (opens in Excel). "Export PDF" uses the browser print dialog → Save as PDF.
- Test flows: `node api/test/smoke.js` (API) and the Playwright script described in the PR/commit for UI.

## Loan rules
- Loans carry **no interest**. Members repay the amount borrowed in equal monthly instalments; a late instalment gets a one-time 5% late-payment penalty.
- The borrowing limit is `multiple × (savings balance + money invested in live schemes)`; the multiple depends on the loan type (`loan_products.max_multiple_of_savings`).
- Every loan needs guarantor consent, then a decision from a **loan manager or the super admin** (admins cannot approve). The accountant, admin or super admin disburses.
- UI: members can hide balances with the eye button (remembered per browser); custom select / date / date-time pickers replace the native controls.
