# Backend audit & hardening plan

Scope: `api/` (NestJS modular monolith, raw SQL via `pg`). Decision: **refactor in place, do not rewrite.** The domain model
(immutable ledger, row-locked transactions, maker-checker approvals, idempotent settlement) is sound and the web app depends on
the current contracts, so the response shape (`{statusCode, message}` errors, bare JSON success bodies) is kept.

## Fixed in this change
| Area | Problem | Fix |
|---|---|---|
| Payments | Webhook credited the member without checking the gateway-reported amount or that the provider matched | Amount (kobo) must equal the initiated amount, provider must match, success events must carry an amount; mismatches are marked `failed` and logged |
| Payments | `/payments/:ref/simulate` let any user settle any member's payment (non-prod) | Owner-only; disabled in staging and production |
| Auth | No brute-force protection | Account lockout (`LOGIN_MAX_FAILURES`/`LOGIN_LOCK_MINUTES`), audit rows for success/fail/lock, timing equalised for unknown users |
| Uploads | Any bytes accepted, stored as `.bin` | Magic-byte sniffing (JPEG/PNG/PDF only), safe generated names, DTO length limits, base64 body excluded from audit log |
| Config | `process.env` read ad hoc | `common/config.ts`: typed, validated at startup, lists every problem |
| HTTP | No request IDs, no security headers beyond 3, internals could leak on 500 | Request-ID + structured access log, Helmet, body limit, global filter that hides 5xx details |
| Audit | Write failures silently swallowed, no request ID | Failures logged; `request_id` column |
| Money | Loan schedule used float arithmetic per step | Computed in integer kobo; principals sum exactly (unit-tested) |
| DB | Missing indexes on hot paths | Migration `002_hardening.sql` (savings sum, loans by member/status, due instalments, payments, audit) |
| Tests/Build | No tests, no Docker | Vitest unit tests (`npm test`), extended smoke test, `Dockerfile` |

## Known gaps (not done — need decisions or credentials)
1. **Money type**: DB uses `numeric(14,2)` (good) but services convert to JS `Number`; `money()` rounds floats. Move ledger/repayment code to integer kobo or a decimal library.
2. **Refresh tokens / logout / sessions**: only a 30-minute access token exists; no revocation list, password reset, email/phone verification.
3. **Permissions**: roles only (`@Roles`). Add a permission table if finer grants are needed.
4. **Idempotency keys** for withdrawals, subscriptions and loan disbursement (payments are idempotent via gateway reference only). Withdrawal posts immediately with no approval.
5. **Real payment provider adapters** (initialize/verify API calls, reconciliation job, refunds/reversals); `initiate` returns a placeholder URL.
6. **Background jobs**: penalties/reminders must be triggered by an external cron; no queue for email/SMS/exports.
7. **Storage**: KYC files on local disk; use private object storage with signed URLs.
8. **Pagination**: several list endpoints are capped (`limit 200`) but not paginated; `members.list` has no search.
9. **OpenAPI** docs, lint config, integration tests in CI, migration down-scripts.
10. **Success envelope** (`{success,data,meta}`) is a breaking change for `web/src/api.ts`; adopt together with a frontend update.
11. Several `any` types remain in `common/db.ts` and modules.
