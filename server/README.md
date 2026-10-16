# Server-backed workspace accounts

This service reuses an **existing PostgreSQL database**. It implements accounts and planning records for this independent project, not FedEx accounts or live shipping services.

## Current activation state

The source is wired for two explicitly selected modes:

- `VITE_WORKSPACE_MODE=browser` (default): the existing, clearly labeled browser-local planning workspace.
- `VITE_WORKSPACE_MODE=server`: verified-email accounts, server-managed sessions, and shared PostgreSQL records. If the API is unavailable or unconfigured, access fails closed; it never falls back to browser passwords, profiles, or administrator flags.

No live database connection, migration, account creation, mail delivery, or deployment was performed as part of preparing this layer. The existing database and mail credentials must be supplied privately in environment settings. Do not paste them into chat or commit a populated `.env`.

## 1. Configure the existing service

Install with Node 22:

```sh
npm ci --prefix server
```

Use the repository-root `.env.example` as a template locally, or set these in the hosting environment:

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` or `NEON_DATABASE_URL` | Existing PostgreSQL connection; use TLS and a restricted database role. |
| `AUTH_SECRET` | A unique, randomly generated signing secret of at least 32 characters. Never prefix this with `VITE_`. |
| `APP_ORIGIN` | Exact public website origin, such as `https://your-site.example`, with no path or wildcard. Production requires HTTPS. Development permits loopback HTTP only. |
| `SMTP_URL` | Actual SMTP/SMTPS transport. Verification and recovery require working mail delivery. SMTP requires TLS; certificates are verified. |
| `MAIL_FROM` | Authorized sender for this application's account email, not an impersonated FedEx sender. |
| `ACCOUNTS_PORT` | Standalone development API port; defaults to 3001. |
| `FEDEX_ENV` | Optional official FedEx API environment: `sandbox` (default) or `production`. |
| `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` | Optional FedEx Developer Portal project credentials, kept server-side only. Both are required before official tracking is enabled. |
| `FEDEX_ACCOUNT_NUMBER` | Optional FedEx shipping account number, kept server-side only. Required only for official shipment creation. |
| `FEDEX_CREATE_SHIPMENTS_ENABLED` | Must be exactly `true` before the administrator-only Ship API endpoint can create shipments. Leave false for tracking-only integration. |
| `FEDEX_API_BASE_URL` | Optional FedEx-approved API base URL override. Normally leave unset so sandbox/production select the official host. |

For an Arena preview, `APP_ORIGIN` must match the **website's HTTPS preview origin**, not the internal API URL. Browser requests always use relative `/api/...` paths. `ACCOUNTS_API_TARGET` is an internal Vite proxy target only; it is not exposed as a browser API URL.

Readiness endpoint: `GET /api/account/status`. It reports configuration setting names and schema availability, never credential values. SMTP configuration presence is not a deliverability test; verify actual delivery after configuring your provider. Public sign-up/recovery responses are intentionally generic and are not delivery receipts; a transport failure never verifies an account or creates an authenticated session.

### Optional official FedEx API

The carrier integration is independent of the account database and is implemented in `src/fedex.js`. It is fail-closed: no FedEx request is made until `FEDEX_CLIENT_ID` and `FEDEX_CLIENT_SECRET` are configured. `GET /api/carrier/status` returns only the provider, environment, enabled features, account-configured boolean, and missing setting names. `GET /api/carrier/track/:number` accepts numeric references, obtains and caches a FedEx OAuth token server-side, calls the Track API, and returns a normalized whitelist of status, service, latest location, dates, and scan events; it never returns FedEx credentials or the raw carrier payload. Public lookups are rate-limited per client IP by the service.

`POST /api/carrier/shipments` is administrator-only and additionally requires `FEDEX_ACCOUNT_NUMBER` plus `FEDEX_CREATE_SHIPMENTS_ENABLED=true`. When enabled, the server-mode administrator Overview shows a confirmation-guarded official-shipment form. The endpoint validates U.S. shipper/recipient addresses and phone numbers, service/packaging/pickup values, ship date, and package weight before calling the Ship API, then returns the carrier-issued tracking number and label reference. Production shipment creation can create a real billable shipment and label; keep the opt-in off until sandbox testing and operational review are complete. Creating an application public shipment never calls this endpoint, and a carrier result is not automatically merged into the application registry.

## 2. Review and apply additive migrations

Back up the existing database first. Then review the generated SQL:

```sh
npm run db:plan
```

Only after reviewing it, explicitly apply:

```sh
npm run db:migrate
```

The service **does not auto-migrate on startup**. Better Auth manages the prefixed identity/session/account/verification/rate-limit tables; the additional SQL adds:

- `fedexr_addresses`
- `fedexr_plans`
- `fedexr_activity`
- `fedexr_settings`
- `fedexr_public_shipments` (from `003-public-shipments.sql`, for administrator-created public tracking records)
- Shipment-operations columns on `fedexr_public_shipments` (from `004-public-shipment-operations.sql`: administrator-only internal notes and archive timestamps)
- Automatic-progression columns on `fedexr_public_shipments` (from `005-public-shipment-auto-progress.sql`: enabled flag, interval minutes, and next-due timestamp)

The original `users`, `admins`, `sessions`, `shipments`, and tracking-image tables are not replaced. Existing `fedexr_*` tables should still be reviewed for name/schema compatibility before applying. Migrations are serialized using a PostgreSQL advisory lock.

## 3. Run and enable the UI

Start the account service:

```sh
npm run dev:accounts
```

Once configuration, schema, and email delivery are ready, set `VITE_WORKSPACE_MODE=server` and restart Vite/build the website. The website remains on port 5173; Vite proxies account requests to the API. Do not expose database URLs, SMTP credentials, or signing secrets through `VITE_*` variables.

In server mode, use `/login` to create a new account, verify its email, and sign in. Existing browser-local profiles are **not verified server identities**. Their passwords and roles are never imported or trusted; their saved data is left untouched in browser storage. Export records from browser mode before switching if you need a copy. Automated record import is not part of this phase.

## 4. Provision the first administrator privately

The dedicated sign-in URL is `/admin/login`, linked from the account menu/footer and personal access screen. `/admin` remains compatible. Server mode never offers browser-local owner setup or trusts browser roles.

There is no default administrator password, public first-owner endpoint, or client-selected admin role.

1. Create and verify a normal account through the website.
2. A trusted server/database operator runs:

```sh
npm --prefix server run admin:grant -- --email owner@your-site.example --confirm
```

3. Sign in again. Existing sessions for the promoted account are revoked.

Administrators can review shared records, save workspace settings, and suspend/reactivate member accounts. Administrator accounts cannot be suspended from the member-status UI. Changing roles requires the trusted operator command, not browser storage.

## Security and behavior

- Better Auth handles password hashing, verification tokens, session signing, reset flows, and authentication throttling; versions are locked in `server/package-lock.json`.
- Sessions are database-backed signed HttpOnly cookies. HTTPS adds `Secure`; cookies use `SameSite=Lax`. JavaScript storage does not hold passwords or session credentials. Sessions are shared across tabs of the same browser, unlike browser-local tab sessions.
- Email verification is required before access. Recovery links expire after 15 minutes and are single-use. Password resets revoke existing sessions; password changes verify the current password and revoke other sessions.
- Account JSON responses do not expose session tokens. Workspace payloads exclude password hashes, verification values, signing keys, and SMTP secrets.
- Server endpoints re-read active account status and role; mutations also lock/re-check the actor inside a database transaction. Record ownership is checked on the server. Administrator flags and client-provided owner IDs do not authorize anything.
- Mutations require JSON and the exact configured origin. Request bodies are capped at 16 KB. Cross-site/missing origins are rejected. The HTTP adapter replaces caller-selected rate-limit IP headers; on Vercel it uses the trusted platform forwarding header.
- Authentication rate limits are stored in PostgreSQL. They are not merely per-browser counters. Production proxy/IP configuration and additional abuse protection should still be reviewed for your hosting architecture.
- Settings and announcements are plain text. They do not send notifications or modify carrier services.
- Activity is appended by the server. The UI shows the latest 100 events. Admin snapshots are bounded at 5,000 rows per category with an explicit truncation notice; totals remain full database counts. Searches/exports cover the returned rows, not an unlimited paginated archive.
- Private image attachments now use server administrator sessions and explicit member ownership. The original API paths are secured by the shared service, not public reference lookups. Legacy key access is opt-in only. Review [`IMAGES.md`](IMAGES.md) for the separate image migration, preserved archive import, limits, and cache cutover.
- Public shipments are a separate registry from private shipment plans. Only server administrators can create, edit, update, correct events, duplicate, archive/restore, hide, or delete them. Blank tracking numbers are generated as application numbers with common FedEx-style lengths—15 digits for Ground or 12 digits for Express-style services—and are not carrier-issued numbers. The `on_hold` status requires a server-validated public-safe `holdReason`; the reason is stored on the shipment’s timeline events inside the existing events JSON, so this feature does not add a database column or require a new migration. The unauthenticated tracking endpoint returns the tracking number, public recipient/shipment label, city/state/ZIP route, service, optional weight, dates, status/location, current hold reason, public note, and events; it removes workspace account identifiers and administrator-only internal notes, and never returns street addresses, email addresses, private notes, or private attachments. Archived shipments are excluded from guest lookup and assigned-member snapshots until restored.
- Rates, pickups, returns, and payments are not connected to carrier services by this account layer. Public shipment events are entered by the application administrator. The separately configured FedEx integration can read official Track API results and—only with the explicit shipment-creation opt-in—create official shipments; it does not merge carrier results into application records.

## Endpoints

- `/api/auth/...`: narrowly allowed sign-up/sign-in/sign-out, verification, and recovery endpoints.
- `GET /api/workspace`: current account and role-filtered records.
- `/api/workspace/addresses`: create; `/:id` update/remove; `/:id/default` choose the preferred address.
- `/api/workspace/plans`: create; `/:id` update/remove; `/:id/status` update planning status.
- `/api/workspace/shipments`: administrator-only create; `/:id` administrator-only update/remove; `/:id/updates` administrator-only public status/location event; `/:id/events/:eventId` administrator-only event correction/removal; `/:id/undo`, `/:id/duplicate`, `/:id/internal-note`, `/:id/archive`, and `/:id/visibility` administrator-only operations.
- `GET /api/tracking/:number`: unauthenticated public-safe lookup for an administrator-created shipment; unknown or hidden records return 404.
- `GET /api/carrier/status`: public FedEx integration status without credential values.
- `GET /api/carrier/track/:number`: public normalized official FedEx Track API lookup when privately configured; otherwise 503.
- `POST /api/carrier/shipments`: verified-administrator-only official FedEx Ship API creation when the account number and explicit creation opt-in are configured.
- `PUT /api/workspace/profile`: name update and confirmed email-change request.
- `PUT /api/workspace/passphrase`: current-passphrase verification and change.
- `PUT /api/workspace/settings`: administrator-only workspace settings.
- `PATCH /api/workspace/members/:id/status`: administrator-only suspension/reactivation, with session revocation.

## Tests

```sh
npm run test:accounts
```

The API tests use an isolated PGlite PostgreSQL engine, not `DATABASE_URL` or the user's database. They cover migrations, verification, forbidden role injection, cookie attributes, CSRF/origin rejection, record ownership/validation, administrator permissions, suspension, recovery replay protection, session revocation, persistent auth throttling, and body limits.

Server-mode browser tests use a separate explicit fixture on port 3003 by default (override with `PLAYWRIGHT_ACCOUNTS_API_PORT`). It is separate from the current preview API on port 3002:

```sh
cd app
PLAYWRIGHT_SERVER_ACCOUNTS=1 npm run test:e2e -- accounts-server.spec.ts --workers=1
```

The fixture runs only with `NODE_ENV=test`; it uses in-memory PostgreSQL, recorded test mail, and fake fixture accounts. It is never imported by production API routes. Do not deploy the fixture. Chromium must retain web security: `--disable-web-security` suppresses Origin headers and invalidates CSRF tests.

The API suite does not prove compatibility with every hosted PostgreSQL version/proxy or actual SMTP delivery. Run the migration plan and staging smoke tests against your own configuration before enabling real accounts.

## Deployment and remaining launch work

`vercel.json` uses the **repository root** for installation/build and `app/dist` as static output, so the root API functions can import the server service. Install the production server dependencies as well as frontend build dependencies. Set server settings privately and scope `APP_ORIGIN` to the deployment's exact public origin.

This is an implemented account/data layer, not a launch/security certification. A production release still needs actual database/mail validation, operational backups and retention, monitoring, administrator MFA, wider pagination/exports as the dataset grows, actual image migration/cache cutover verification, and any separately authorized carrier integration. Review brand/image permissions and privacy requirements before a public launch.

The combined API suite currently has 48 cases, including administrator-only public-shipment creation/update, server-validated hold reasons and public hold/release state, guest lookup, hidden-record 404 behavior, assigned-member snapshots, public-response account-data exclusion, FedEx configuration secrecy, mocked OAuth/Track API normalization, carrier not-found handling, and administrator-only official shipment creation. The server-mode browser file has 10 cases per project, including cross-context public tracking and a mocked official-shipment creation workflow. Tests do not connect to the existing database, send real email, or call the real FedEx API.
