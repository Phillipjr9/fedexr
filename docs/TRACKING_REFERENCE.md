# Tracking-page visual reference

Reviewed October 14, 2026 for the existing React/Vite project.

## References used

- Official public tracking entry page: https://www.fedex.com/en-us/tracking.html — white tracking form, alternate tracking methods, orange Track action, and delivery-resource cards.
- Official detailed-tracking application: https://www.fedex.com/fedextrack/ — the live page is a JavaScript application and its rendered shipment-specific content is not available through a text-only fetch.
- Published detailed-results screenshot on https://www.trackingmore.com/fedex-tracking.html (image: https://upload-public.oss-us-east-1.aliyuncs.com/trackingmore_manage/2024/08/1751a42efb149eee1551368d70164b6f.png) — reference for the white three-column delivered summary, date/status/reference hierarchy, blue text actions, green vertical scan rail, pale rounded delivered state, and rounded See full details action. Used as a visual reference only; the screenshot is not embedded in the site.
- Official redesign description: https://www.fedex.com/content/fedex-com/sites/us/en_us/see-whats-new.html — secondary context for the minimalist tracking presentation, not a claim that every current regional/login state has the same layout.

FedEx pages can vary by date, region, account, shipment status, and experiments. This rebuild follows the published reference layout; it does not certify pixel identity with every live FedEx view. The shared site's navigation/footer are retained rather than replacing the existing project.

## Deliberate differences

- A clearly visible independent-preview notice remains. Entered numbers resolve against administrator-created public shipment records; dates, events, package facts, and routes come from that public record and are never inferred merely from the reference. `LOCAL-12345` remains the labeled sample, and unknown numbers show not-found instead of a fabricated journey.
- No customer identity, tracking number, delivery address, proof photo, or signature from an online screenshot is copied into the sample dataset.
- The photo area only displays an application attachment after the existing API confirms private access. It is not carrier-provided delivery proof. Missing/unauthorized/unconfigured files show an honest placeholder and explanation; no substitute delivery photo is invented.
- Real delivery changes, proof of delivery, status alerts, reference/TCN tracking, and missing-package reports link to official FedEx tools. No fake submission or carrier confirmation is shown.
- Nicknames and the visit marker last only in React page state. Clipboard and print controls are functional. No tracking list or nickname is persisted into browser storage or sent to FedEx.
- Genuine, locally hosted FedEx photographs already documented in `app/public/images/fedex/SOURCES.md` are reused for the resource cards. No AI imagery or remote hotlinks are introduced.
- Private attachments, account loading, account/role changes, event-category validation, request cancellation, and old/public-response rejection preserve the existing authorization boundary.

## Implementation

- `app/src/pages/TrackingPage.tsx`: reference entry/results layout, compact tracking bar, actions, private image viewer, and resource links.
- `app/src/tracking.css`: page-scoped desktop/tablet/mobile/print styles; no global header or dashboard restyling.
- `app/src/lib/tracking.ts`: attachment-category validation and the official FedEx tracking handoff.
- `app/src/lib/publicShipments.ts`: public status definitions, tracking-number normalization/generation, validation, and the built-in sample record.
- `app/src/components/tracking/PublicTrackingDetails.tsx`: accessible full-details tabs, administrator-entered event sorting, local/destination/UTC time zones, and public shipment facts.
- `app/src/hooks/use-tracking-attachment.ts`: abortable, identity-scoped private-image fetching. Account or reference changes cannot display a previous request's image.
- `app/tests/tracking.spec.ts`: form/URL behavior, layout, true external handoffs, details controls, temporary state, image privacy/viewer behavior, request races, and long references.

Direct sample view: `/tracking?number=LOCAL-12345`. This does not create a shipment, verify delivery, or activate carrier services.

## Validation

27 tracking browser cases passed across desktop/tablet/mobile, alongside 12 existing tracking/handoff cases, all 27 server-mode account/image/public-shipment browser cases, and all 41 backend cases. Nine additional browser-local public-shipment cases cover administrator creation/update, guest tracking after sign-out, assigned-member visibility, and unknown-number handling. The dedicated audit checked 75 entry/results/details/dialog/permission/long-reference states across 320, 390, 768, 1440, and 1920 px with zero reported WCAG A/AA violations, horizontal document overflow, or runtime errors. Automated checks are not a production/security certification.

## Timeline alignment correction

The delivered-state background is a separate layer below the full-width rail. The rail, small milestone dots, and large delivered check badge share one CSS centerline; label offsets are also shared across breakpoints. The tablet journey/header use the same bounded column. Geometry regression checks cover 320, 390, 600, 768, 900, 901, 1050, 1440, and 1920 px, including both sides of layout breakpoints. High-density screenshots were also sampled to verify the rail remains green across its full width below the badge. Sample scan content and private attachment authorization are unchanged.
