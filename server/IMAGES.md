# Private application image attachments

These are application-managed reference images, **not FedEx delivery proof or live tracking data**. The existing API paths are retained, but anonymous reference-based image access is deliberately removed.

## Access rules

- A verified, active **server administrator** can save, load, replace, change visibility, and remove attachments using the signed HttpOnly account session. No shared key is needed in server-account mode.
- A member can read only an image explicitly assigned to that account by an administrator. Creating a local or database-backed plan with the same reference does not grant access.
- `ownerId: null` means administrators-only. Omitted owner on a session-admin upload defaults to that administrator's account. Account IDs must exist and be active; an unverified recipient still cannot read anything until email verification.
- Browser-local profiles, `isAdmin` flags, and knowledge of a tracking reference do not authorize files.
- Optional operator-key access must be enabled with `ALLOW_LEGACY_IMAGE_KEY=true`. `ADMIN_SECRET` must contain 32–256 printable non-space ASCII characters, be randomly generated, and be **different from `AUTH_SECRET`**. This is an administrator-level capability; leave it disabled in normal server-account deployments. The key belongs in request headers, never a query string. Operator-key uploads are administrators-only and cannot assign member visibility.
- Operator-only installations need an existing database and exact `APP_ORIGIN`, but do not need account/email configuration. This is an explicit compatibility mode, not an automatic fallback if account authentication fails.

## Migration: no request-time schema changes

Neither API endpoint creates or alters tables. Back up the database and stop writes from the old endpoint before cutover.

```sh
npm run images:plan
# Review the schema, source layout/count, and cutover warning before proceeding.
npm run images:migrate
```

Both commands read the existing private database setting (`DATABASE_URL` or `NEON_DATABASE_URL`). Do not paste connection strings or keys into chat. The plan performs metadata/count reads only; applying requires the explicit migration command.

The migration adds `fedexr_tracking_images` with a composite `(tracking_number, event_type)` primary key, validated JPEG/PNG bytes, dimensions, checksum, explicit account ownership, and timestamps. `fedexr_image_limits` stores bounded per-principal request counters.

The old `tracking_images` table is retained untouched as an archive:

- The historical **reference-only primary-key** layout is imported under category `default`.
- The historical **event-keyed** layout preserves supported categories.
- Imports are decoded and re-encoded, stripped of metadata, and made **administrators-only**. Legacy references are never treated as proof of account ownership.
- Invalid, unsupported, oversized, or undecodable source rows are counted as deferred and remain in the untouched archive. They are not exposed by the new API.
- Existing rows in the new private table, including newer files and visibility assignments, are never overwritten by repeat imports.
- Source reads are bounded in batches; oversized blobs are not materialized in the migration process. The importer runs in a repeatable-read transaction with an advisory lock. Use a maintenance window for larger archives.
- Do not resume the old endpoint after importing: late writes to its archive are not live data. A repeat import intentionally will not overwrite an existing private record.
- When the account schema exists, owner/creator foreign keys are installed. If images were migrated before accounts, rerun the image migration after the account migration to install them. Deleting an owning account cascades its private attachments; the historical archive is separate and needs its own retention policy.

**Cache cutover:** the old GET endpoint used shared CDN caching. Purge old cached responses or wait beyond their complete cache/stale lifetime before relying on private access. The new implementation sends `Cache-Control: private, no-store` on every image response, including errors. It cannot retract files already downloaded, cached elsewhere, or previously published by the old implementation.

The original all-purpose `migrations/create_tables.sql` remains historical schema support, not the new image upgrade command.

## API contract

- `POST /api/upload-tracking-image`: JSON `{ trackingNumber, eventType?, dataUrl, ownerId? }`.
- `GET /api/get-tracking-image?number=...&event=...`: private lookup, with `event` defaulting to `default`.
- `PATCH /api/upload-tracking-image`: JSON `{ trackingNumber, eventType?, ownerId }`; session administrator only; modifies visibility without re-uploading/re-encoding the file.
- `DELETE /api/upload-tracking-image`: JSON `{ trackingNumber, eventType? }`; administrator/operator only; returns `{ ok: true, removed: boolean }` and is idempotent.

References are trimmed 4–40 character application references containing letters/numbers/spaces/hyphens, with at least one alphanumeric character. Supported categories are `default`, `in_transit`, `delivered`, and `other`. Duplicate reference/category query parameters are rejected. Data access is based on server permissions, not client-provided owner claims or plan references.

Mutations require JSON and the exact application Origin. Compressed request bodies are rejected. The shared HTTP adapter permits bounded image-upload JSON while keeping account and other mutation bodies limited to 16 KB. Serverless wrappers use the same adapter/service as local development, and Vite proxies both image paths through relative browser URLs.

Image JSON responses carry `access: "private"`; the UI refuses old/public or unknown success contracts instead of claiming a private save/view. This marker is a deployment-compatibility guard, not a substitute for server authorization or retiring old CDN caches.

Errors are explicit: 401 for missing/invalid account authorization, 403 for forbidden capabilities/origins, 404 for no accessible image, 413 for excessive size, 415/422 for unsupported/unsafe images, 429 for rate limits, and 503 for unconfigured/unavailable services or missing migration. An unconfigured operator/account service may return 503 before authentication can be evaluated. Error output never includes keys, database credentials, raw image bytes, or decoder internals.

## File processing and limits

- Non-empty JPEG or PNG input, **2 MB maximum** before and after processing.
- Strict canonical base64, an allowlisted MIME, and matching file signatures.
- Full decoding using Sharp/libvips; at most **16 million pixels**, **8192 pixels per edge**, single-frame images only. Animation headers and invalid/truncated images are rejected.
- Re-encoding strips EXIF/GPS, comments, profiles, and trailing content; EXIF orientation is applied. JPEG re-encoding can change bytes/quality. Keep originals outside this app for actual claims/evidence.
- Stored checksums and bounded image inspection guard reads against corrupt data. API responses contain only validated image data and safe metadata, never passphrases/session credentials.
- Per principal, per minute: 10 save/visibility requests, 60 reads, and 20 removals. Counters are persisted and failures return `Retry-After`. Invalid authentication never grants a counter-backed capability. These limits complement, not replace, production edge/network abuse protection.

The frontend uses local previews before upload and a separate server-confirmed preview afterward. Busy fields prevent accidental reference/category edits mid-request. Failed actions do not claim a save/removal. Keys are cleared after successful operator actions and never carried by tracking links. A member's tracking view still explicitly shows simulated history, regardless of whether an application image is present.

## Validation and deployment

```sh
npm run test:accounts
# Includes the isolated private-image API and migration tests.
```

The tests use an isolated PostgreSQL engine and fake mail, not your existing database. Coverage includes both legacy layouts, idempotent imports, preserved archives, full decoding/metadata stripping, size/body bounds, forged/local flags, ownership, visibility changes, live role/status checks, operator opt-in, private cache headers, deletion, persisted throttling, stored corruption, and no automatic DDL.

Server-account browser tests also cover administrator-cookie uploads, explicit member visibility, public denial, spoofed-image rejection, visibility revocation, and removal across desktop/tablet/mobile. Native Sharp runtime packages must be installed for the deployment platform; normal `npm ci --prefix server` installs its optional platform packages. No new image service or schema has been activated on a live database automatically.

Before production, verify the migration plan against the actual database, SMTP/account readiness for session mode, host Origin, native decoder deployment, private access, old cache retirement, backups/retention (including archives), monitoring, and authorized branding/image use. This is not a security certification or a carrier integration.

The dedicated attachment UI audit covered 50 state/viewport combinations (320–1920 px), including real private saves/views and mocked operator UI states: no overflow, runtime exceptions, or Axe A/AA violations. Full functional validation passed 40 backend tests, 21 server-mode browser checks, and 135 public/browser-local regressions.
