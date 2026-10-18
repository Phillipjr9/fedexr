import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  Info,
  LockKeyhole,
  Mail,
  Maximize2,
  MoreVertical,
  PackageSearch,
  Pause,
  Pencil,
  Printer,
  Search,
  ShieldCheck,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import BrandImage from '@/components/BrandImage';
import PublicTrackingDetails from '@/components/tracking/PublicTrackingDetails';
import { useTrackingAttachment } from '@/hooks/use-tracking-attachment';
import { useWorkspace } from '@/context/workspace';
import { attachmentCategory, officialTrackingURL } from '@/lib/tracking';
import {
  carrierTrackingCandidate,
  getCarrierStatus,
  lookupCarrierShipment,
  unavailableCarrierStatus,
  type CarrierTrackingResult,
} from '@/lib/carrier';
import {
  displayShipmentEvents,
  holdReasonLabel,
  latestShipmentEvent,
  normalizeTrackingNumber,
  placeLabel,
  shipmentStatusLabel,
} from '@/lib/publicShipments';
import { sampleServices } from '@/lib/shipping';
import type { PublicShipment } from '@/lib/workspace';
import { siteImages } from '@/lib/siteAssets';
import '@/tracking.css';

function CarrierLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`fx-carrier-link ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <span className="sr-only"> (official external service, opens in a new tab)</span>
    </a>
  );
}

export default function TrackingPage() {
  const [params] = useSearchParams();
  const focusOnMountRef = useRef(false);
  return (
    <TrackingView
      focusOnMountRef={focusOnMountRef}
      key={JSON.stringify([
        (params.get('number') || '').slice(0, 80).trim(),
        attachmentCategory(params.get('event')),
      ])}
    />
  );
}

function TrackingView({ focusOnMountRef }: { focusOnMountRef: RefObject<boolean> }) {
  const [params, setParams] = useSearchParams();
  const queryNumber = (params.get('number') || '').slice(0, 80);
  const category = attachmentCategory(params.get('event'));
  const { user, mode, loading: accountLoading, data, lookupPublicShipment } = useWorkspace();
  const reduceMotion = useReducedMotion();
  const [trackingNumber, setTrackingNumber] = useState(queryNumber);
  const [submitted, setSubmitted] = useState(queryNumber.trim());
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [nickname, setNickname] = useState('');
  const [draftName, setDraftName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [marked, setMarked] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [stagePhotoView, setStagePhotoView] = useState<{ src: string; label: string } | null>(null);
  const [lookup, setLookup] = useState<{
    reference: string;
    shipment: PublicShipment | null;
    loading: boolean;
    error: string;
  }>({ reference: '', shipment: null, loading: false, error: '' });
  const [carrierStatus, setCarrierStatus] = useState(unavailableCarrierStatus);
  const [carrierLookup, setCarrierLookup] = useState<{
    reference: string;
    result: CarrierTrackingResult | null;
    loading: boolean;
    error: string;
  }>({ reference: '', result: null, loading: false, error: '' });
  const lookupRef = useRef(lookupPublicShipment);
  const activeReference = useRef(queryNumber.trim());
  const inputRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const attachment = useTrackingAttachment({
    number: submitted,
    category,
    principal: JSON.stringify([mode, user?.id, user?.role]),
    ready: mode !== 'server' || !accountLoading,
    server: mode === 'server',
    revision,
  });

  useEffect(() => {
    lookupRef.current = lookupPublicShipment;
  }, [lookupPublicShipment]);
  useEffect(() => {
    if (focusOnMountRef.current) {
      focusOnMountRef.current = false;
      inputRef.current?.focus();
    }
  }, [focusOnMountRef]);
  useEffect(() => {
    const previous = document.title;
    document.title = 'FedEx Tracking | Independent workspace';
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    if (!submitted || mode === 'browser') return;
    let active = true;
    void lookupRef
      .current(submitted)
      .then((shipment) => {
        if (active)
          setLookup({
            reference: submitted,
            shipment,
            loading: false,
            error: '',
          });
      })
      .catch((cause) => {
        if (active)
          setLookup({
            reference: submitted,
            shipment: null,
            loading: false,
            error: cause instanceof Error ? cause.message : 'Tracking lookup is unavailable.',
          });
      });
    return () => {
      active = false;
    };
  }, [submitted, mode]);

  useEffect(() => {
    const controller = new AbortController();
    void getCarrierStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) setCarrierStatus(status);
      })
      .catch(() => {
        /* The unavailable status keeps the application record fully usable. */
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!submitted || !carrierStatus.trackingEnabled || !carrierTrackingCandidate(submitted))
      return;
    const controller = new AbortController();
    void lookupCarrierShipment(submitted, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setCarrierLookup({ reference: submitted, result, loading: false, error: '' });
      })
      .catch((cause) => {
        if (controller.signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError'))
          return;
        setCarrierLookup({
          reference: submitted,
          result: null,
          loading: false,
          error:
            cause instanceof Error ? cause.message : 'Official FedEx lookup is unavailable.',
        });
      });
    return () => controller.abort();
  }, [submitted, carrierStatus.trackingEnabled]);

  function track(number: string) {
    const reference = number.trim();
    if (!reference) {
      setError('Please enter a tracking number.');
      inputRef.current?.focus();
      return;
    }
    if (reference.length > 80) {
      setError('Use a tracking reference up to 80 characters.');
      inputRef.current?.focus();
      return;
    }
    if (reference !== activeReference.current) {
      setDetailsOpen(false);
      setNickname('');
      setMarked(false);
    }
    activeReference.current = reference;
    setTrackingNumber(reference);
    setSubmitted(reference);
    setError('');
    setNotice('');
    setImageOpen(false);
    setRevision((value) => value + 1);
    const next = new URLSearchParams({ number: reference });
    if (category !== 'default' || params.has('event')) next.set('event', category);
    setParams(next, { replace: true });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    track(trackingNumber);
  }
  function startAgain() {
    focusOnMountRef.current = true;
    activeReference.current = '';
    setTrackingNumber('');
    setSubmitted('');
    setParams({}, { replace: true });
    setDetailsOpen(false);
    setNickname('');
    setMarked(false);
    setNotice('');
    setError('');
    setImageOpen(false);
  }
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(submitted);
      setNotice('Tracking reference copied.');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setNotice('Select and copy the reference in the tracking field.');
    }
  }
  function showDetails() {
    const open = !detailsOpen;
    setDetailsOpen(open);
    if (open)
      requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({
          block: 'start',
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
        detailsRef.current?.focus({ preventScroll: true });
      });
  }
  const normalizedSubmitted = normalizeTrackingNumber(submitted);
  const browserShipment = submitted
    ? data.shipments.find(
        (entry) =>
          entry.isPublic &&
          !entry.archivedAt &&
          normalizeTrackingNumber(entry.trackingNumber) === normalizedSubmitted,
      ) || null
    : null;
  const activeLookup =
    mode === 'browser'
      ? { shipment: browserShipment, loading: false, error: '' }
      : lookup.reference === submitted
        ? lookup
        : { shipment: null, loading: Boolean(submitted), error: '' };
  const shipment = activeLookup.shipment;
  const lookupLoading = Boolean(submitted && activeLookup.loading);
  const latestEvent = shipment ? latestShipmentEvent(shipment) : undefined;
  const service = shipment ? sampleServices.find((option) => option.id === shipment.service) : undefined;
  const delivered = shipment?.status === 'delivered';
  const onHold = shipment?.status === 'on_hold';
  const holdIssue = onHold && shipment ? holdReasonLabel(shipment.holdReason) : '';
  const statusLabel = shipment ? shipmentStatusLabel(shipment.status) : '';
  const journeyEvents = shipment ? displayShipmentEvents(shipment) : [];
  const stagePhotoFor = (status: string) => {
    if (!shipment) return '';
    let photo = '';
    for (const event of [...shipment.events].sort((a, b) => a.at.localeCompare(b.at))) {
      if (event.status === status && event.photo) photo = event.photo;
    }
    return photo;
  };
  const deliveryPhoto = stagePhotoFor('delivered');
  const onRoutePhoto = stagePhotoFor('in_transit');
  const summaryStagePhoto = delivered ? deliveryPhoto : onRoutePhoto;
  const summaryStageLabel = delivered ? 'Delivery' : 'On-route';
  const currentJourneyId = delivered
    ? [...journeyEvents].reverse().find((event) => event.status === 'delivered')?.id
    : latestEvent?.id;
  const formatEventDay = (value: string) =>
    new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(value));
  const formatEventTime = (value: string) => {
    const date = new Date(value);
    const day = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
    return `${day} at ${time}`;
  };
  const estimatedDate = shipment?.estimatedDelivery
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${shipment.estimatedDelivery}T12:00:00`))
    : 'Not provided';
  const carrierCandidate = carrierTrackingCandidate(submitted);
  const activeCarrierLookup =
    carrierLookup.reference === submitted
      ? carrierLookup
      : {
          result: null,
          loading: Boolean(submitted && carrierStatus.trackingEnabled && carrierCandidate),
          error: '',
        };
  const carrierResult = activeCarrierLookup.result;
  const formatCarrierDate = (value: string) => {
    if (!value) return 'Not provided';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      ...(value.includes('T') ? { hour: 'numeric', minute: '2-digit' } : {}),
    }).format(date);
  };
  const carrierPanel = submitted ? (
    <section className="fx-carrier-panel" aria-labelledby="carrier-panel-heading">
      <div className="fx-carrier-panel-heading">
        <div>
          <p className="fx-eyebrow">Side-by-side sources</p>
          <h2 id="carrier-panel-heading">Application record and official FedEx</h2>
          <p>
            The two sources stay separate. Creating or changing the application record never
            changes a FedEx shipment.
          </p>
        </div>
        <span className={`fx-carrier-env ${carrierStatus.configured ? 'is-connected' : ''}`}>
          {carrierStatus.configured
            ? carrierStatus.environment === 'production'
              ? 'Production API'
              : 'Sandbox API'
            : 'API not connected'}
        </span>
      </div>
      <div className="fx-carrier-grid">
        <article className="fx-carrier-card">
          <div className="fx-carrier-card-title">
            <ShieldCheck size={21} aria-hidden="true" />
            <h3>Application record</h3>
          </div>
          <p className="fx-carrier-status">
            <strong>Application status:</strong>{' '}
            {shipment ? statusLabel : lookupLoading ? 'Checking…' : 'No matching record'}
          </p>
          <p>
            {shipment
              ? 'Entered by this site’s administrator in the public-shipment registry.'
              : 'This number is not in the application’s public-shipment registry.'}
          </p>
          {shipment && (
            <p>
              Current location: {shipment.currentLocation}. Estimated delivery: {estimatedDate}.
            </p>
          )}
        </article>
        <article className="fx-carrier-card fx-carrier-card-official">
          <div className="fx-carrier-card-title">
            <Cloud size={21} aria-hidden="true" />
            <h3>Official FedEx API</h3>
          </div>
          {!carrierStatus.trackingEnabled ? (
            <>
              <p className="fx-carrier-status">
                <strong>Connection:</strong> Not configured on this server
              </p>
              <p>
                Add the private FedEx Developer Portal credentials on the server to enable live
                API lookup here. Until then, use the official FedEx tracking site.
              </p>
              {carrierStatus.missing.length > 0 && (
                <p className="fx-carrier-missing">
                  Missing server settings: {carrierStatus.missing.join(', ')}
                </p>
              )}
            </>
          ) : !carrierCandidate ? (
            <>
              <p className="fx-carrier-status">
                <strong>Lookup:</strong> Skipped for this application reference
              </p>
              <p>
                Official API lookup runs for numeric FedEx-style tracking numbers. This reference
                can still be an application-only record.
              </p>
            </>
          ) : activeCarrierLookup.loading ? (
            <p className="fx-carrier-status">Checking FedEx…</p>
          ) : activeCarrierLookup.error ? (
            <>
              <p className="fx-carrier-status">
                <strong>Lookup:</strong> Unavailable
              </p>
              <p>{activeCarrierLookup.error}</p>
            </>
          ) : carrierResult?.found ? (
            <>
              <p className="fx-carrier-status">
                <strong>FedEx status:</strong> {carrierResult.status || 'Status provided'}
              </p>
              <dl className="fx-carrier-facts">
                <div>
                  <dt>Service</dt>
                  <dd>{carrierResult.service || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Latest location</dt>
                  <dd>{carrierResult.latestLocation || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Estimated delivery</dt>
                  <dd>{formatCarrierDate(carrierResult.estimatedDelivery)}</dd>
                </div>
                {carrierResult.actualDelivery && (
                  <div>
                    <dt>Delivered</dt>
                    <dd>{formatCarrierDate(carrierResult.actualDelivery)}</dd>
                  </div>
                )}
              </dl>
              {carrierResult.events.length > 0 && (
                <ol className="fx-carrier-events">
                  {carrierResult.events.slice(0, 5).map((event, index) => (
                    <li key={`${event.at}-${index}`}>
                      <strong>{event.description || 'Tracking update'}</strong>
                      <span>
                        {event.location}
                        {event.location && event.at ? ' · ' : ''}
                        {event.at ? formatCarrierDate(event.at) : ''}
                      </span>
                      {event.detail && <span>{event.detail}</span>}
                    </li>
                  ))}
                </ol>
              )}
              <p className="fx-carrier-source-note">
                Returned by FedEx through this server in the{' '}
                {carrierStatus.environment === 'production' ? 'production' : 'sandbox test'}{' '}
                environment
                {carrierStatus.environment === 'production'
                  ? '.'
                  : '; sandbox results are test data, not a live delivery record.'}
              </p>
            </>
          ) : (
            <>
              <p className="fx-carrier-status">
                <strong>FedEx status:</strong> No matching FedEx record
              </p>
              <p>{carrierResult?.message || 'FedEx has no tracking record for this number.'}</p>
            </>
          )}
          <CarrierLink href={officialTrackingURL(submitted)}>
            Open this number on FedEx <ExternalLink size={14} aria-hidden="true" />
          </CarrierLink>
        </article>
      </div>
    </section>
  ) : null;
  const form = (
    <form
      className={`fx-tracking-form ${submitted ? 'fx-tracking-form-compact' : ''}`}
      onSubmit={submit}
      noValidate
      aria-label="Track a reference"
    >
      <div className="fx-tracking-field">
        <label htmlFor="tracking-number">Tracking number</label>
        <input
          id="tracking-number"
          ref={inputRef}
          placeholder="Enter tracking number"
          value={trackingNumber}
          onChange={(event) => {
            setTrackingNumber(event.target.value);
            setError('');
          }}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'tracking-input-error' : undefined}
        />
      </div>
      <button
        type="submit"
        className="fx-track-submit"
        disabled={mode === 'server' && accountLoading}
      >
        <Search size={18} aria-hidden="true" />
        <span>Track</span>
      </button>
      {error && (
        <p id="tracking-input-error" role="alert" className="fx-input-error">
          {error}
        </p>
      )}
    </form>
  );

  return (
    <div className="fx-tracking-page">
      <header className="fx-tracking-subnav">
        <div className={`fx-track-container fx-subnav-inner ${submitted ? 'has-result' : ''}`}>
          <h1>FedEx Tracking</h1>
          {submitted && (
            <div className="fx-subnav-tools">
              <div className="fx-result-search">
                {form}
                <button
                  className="fx-icon-button fx-print-button"
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Print sample tracking details"
                >
                  <Printer size={21} aria-hidden="true" />
                </button>
              </div>
              <div className="fx-subnav-actions">
                <button type="button" onClick={startAgain} className="fx-text-button">
                  Track another shipment
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="fx-icon-button"
                      type="button"
                      aria-label="More tracking options"
                    >
                      <MoreVertical size={23} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        void copyReference();
                      }}
                    >
                      Copy tracking reference
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => window.print()}>
                      Print sample details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={startAgain}>
                      Track another shipment
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </header>
      <div className="fx-track-container">
        <div className="fx-tracking-disclosure">
          <Info size={17} aria-hidden="true" />
          <p>
            <strong>Independent preview.</strong> Results show application shipment records created
            by this site’s administrator, not live FedEx carrier scans. When configured, the
            separate Official FedEx API panel below queries FedEx from this server.
          </p>
          <CarrierLink
            href={
              submitted
                ? officialTrackingURL(submitted)
                : 'https://www.fedex.com/en-us/tracking.html'
            }
          >
            Use official tracking <ExternalLink size={14} aria-hidden="true" />
          </CarrierLink>
        </div>
        {!submitted ? (
          <section className="fx-tracking-entry" aria-labelledby="tracking-entry-heading">
            <h2 id="tracking-entry-heading">
              Track your FedEx<sup>®</sup> shipments
            </h2>
            <nav className="fx-tracking-methods" aria-label="Tracking methods">
              <span aria-current="page">Tracking number</span>
              <CarrierLink href="https://www.fedex.com/en-us/tracking.html">
                Track by reference
              </CarrierLink>
              <CarrierLink href="https://www.fedex.com/en-us/tracking.html">
                Obtain proof of delivery
              </CarrierLink>
              <CarrierLink href="https://www.fedex.com/en-us/tracking.html">
                Track by TCN
              </CarrierLink>
            </nav>
            <p className="fx-entry-instruction">
              Enter the tracking number supplied by the administrator to view shipment status.
            </p>
            {form}
            <div className="fx-entry-help">
              <Link to="/support">Need help?</Link>
            </div>
            <p className="fx-entry-limit">
              One reference at a time in this preview. Reference, TCN, and proof-of-delivery
              services open on the official FedEx website.
            </p>
          </section>
        ) : (
          <>
            {notice && (
              <p className="fx-tracking-feedback" role="status">
                {notice}
              </p>
            )}
            {onHold && shipment && (
              <section className="fx-hold-alert" role="alert" aria-labelledby="hold-issue-heading">
                <TriangleAlert size={30} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <p className="fx-hold-alert-eyebrow">Shipment on hold</p>
                  <h2 id="hold-issue-heading">{holdIssue}</h2>
                  <p>
                    Delivery is paused while this issue is resolved. The most recent update places
                    this shipment at {shipment.currentLocation}.
                    {latestEvent?.note ? ` Latest update: ${latestEvent.note}` : ''}
                  </p>
                  <p className="fx-hold-alert-note">
                    This hold reason was selected by the shipment administrator for this
                    application record. For a real FedEx shipment, use the official FedEx tracking
                    service.
                  </p>
                </div>
              </section>
            )}
            <section className="fx-shipment-summary" aria-labelledby="tracking-summary-heading">
              <h2 id="tracking-summary-heading" className="sr-only">
                Public shipment overview
              </h2>
              <div className="fx-delivery-date">
                <p className="fx-eyebrow">
                  {shipment
                    ? delivered
                      ? 'Delivered · Application shipment'
                      : `${statusLabel} · Application shipment`
                    : lookupLoading
                      ? 'Looking up shipment'
                      : 'Tracking number not found'}
                </p>
                <p className="fx-delivery-day">
                  {shipment
                    ? delivered && latestEvent
                      ? formatEventDay(latestEvent.at)
                      : statusLabel
                    : lookupLoading
                      ? 'Checking…'
                      : 'Not found'}
                </p>
                <p className="fx-delivery-time">
                  {shipment
                    ? delivered && latestEvent
                      ? formatEventTime(latestEvent.at)
                      : `Estimated delivery: ${estimatedDate}`
                    : lookupLoading
                      ? 'Searching application records…'
                      : 'No public shipment matches this number'}
                </p>
                <p className="fx-delivery-description">
                  {shipment
                    ? delivered
                      ? 'The administrator has recorded this shipment as delivered.'
                      : `Current location: ${shipment.currentLocation}.`
                    : lookupLoading
                      ? 'Please wait while the application checks for a public shipment.'
                      : 'Check the number and try again, or ask the sender to confirm it.'}
                </p>
                <p className="fx-signature-note">
                  {shipment
                    ? 'Application record only. No carrier delivery or signature is verified here.'
                    : 'No shipment details are shown for an unmatched tracking number.'}
                </p>
                <CarrierLink href={officialTrackingURL(submitted)} className="fx-proof-link">
                  <Download size={17} aria-hidden="true" />
                  Obtain proof of delivery
                </CarrierLink>
                <p className="fx-official-note">Opens the official FedEx tracking tool.</p>
                <div className="fx-delivery-help">
                  <PackageSearch size={35} strokeWidth={1.4} aria-hidden="true" />
                  <div>
                    <h3>Need help with a real delivery?</h3>
                    <p>Check current updates or explore delivery options on FedEx.</p>
                    <CarrierLink href={officialTrackingURL(submitted)}>
                      Go to official tracking <ExternalLink size={14} aria-hidden="true" />
                    </CarrierLink>
                  </div>
                </div>
              </div>
              <div className="fx-delivery-status">
                <p className="fx-eyebrow">Delivery status</p>
                <div className="fx-status-line">
                  <p>
                    {shipment
                      ? statusLabel
                      : lookupLoading
                        ? 'Looking up…'
                        : activeLookup.error
                          ? 'Lookup unavailable'
                          : 'Not found'}
                  </p>
                  {delivered && (
                    <span className="fx-delivered-check">
                      <Check size={19} strokeWidth={2.6} aria-hidden="true" />
                    </span>
                  )}
                  {onHold && (
                    <span className="fx-hold-check" aria-label="Currently on hold">
                      <Pause size={18} strokeWidth={2.6} aria-hidden="true" />
                    </span>
                  )}
                </div>
                {shipment && (
                  <p className="fx-public-route">
                    {placeLabel(
                      shipment.originCity,
                      shipment.originRegion,
                      shipment.originPostalCode,
                    )}{' '}
                    →{' '}
                    {placeLabel(
                      shipment.destinationCity,
                      shipment.destinationRegion,
                      shipment.destinationPostalCode,
                    )}
                    {service ? ` · ${service.name}` : ''}
                  </p>
                )}
                {activeLookup.error && (
                  <p className="fx-attachment-message" role="status">
                    {activeLookup.error}
                  </p>
                )}
                <CarrierLink
                  href="https://www.fedex.com/en-us/delivery-manager.html"
                  className="fx-updates-link"
                >
                  <Mail size={17} aria-hidden="true" />
                  Get Status Updates
                </CarrierLink>
                <div
                  className={`fx-delivery-photo ${summaryStagePhoto || attachment.image ? 'has-photo' : ''}`}
                  aria-busy={attachment.loading}
                >
                  {summaryStagePhoto ? (
                    <button
                      className="fx-open-photo"
                      type="button"
                      onClick={() =>
                        setStagePhotoView({ src: summaryStagePhoto, label: summaryStageLabel })
                      }
                      aria-label={`Enlarge public ${summaryStageLabel.toLowerCase()} photo`}
                    >
                      <img
                        src={summaryStagePhoto}
                        alt={`Public ${summaryStageLabel.toLowerCase()} photo for this shipment`}
                      />
                      <span>
                        <Maximize2 size={17} aria-hidden="true" />
                        View photo
                      </span>
                    </button>
                  ) : attachment.image ? (
                    <button
                      className="fx-open-photo"
                      type="button"
                      onClick={() => setImageOpen(true)}
                      aria-label="Enlarge private application attachment"
                    >
                      <img src={attachment.image} alt="Application image attachment" />
                      <span>
                        <Maximize2 size={17} aria-hidden="true" />
                        View image
                      </span>
                    </button>
                  ) : (
                    <div className="fx-photo-placeholder">
                      <Camera size={45} strokeWidth={1.25} aria-hidden="true" />
                      <h3>Private application attachment</h3>
                      <p>
                        {attachment.loading
                          ? 'Checking attachment access…'
                          : 'A delivery photo is not supplied by this preview.'}
                      </p>
                      <LockKeyhole size={16} aria-hidden="true" />
                    </div>
                  )}
                </div>
                {summaryStagePhoto ? (
                  <p className="fx-image-caption">
                    Public {summaryStageLabel.toLowerCase()} photo added by the shipment
                    administrator to this application record—not carrier-provided delivery proof.
                  </p>
                ) : (
                  attachment.image && (
                    <p className="fx-image-caption">
                      Uploaded by this application’s administrator—not carrier-provided delivery
                      proof.
                    </p>
                  )
                )}
                {attachment.message && (
                  <div className="fx-attachment-message" role="status">
                    <LockKeyhole size={16} aria-hidden="true" />
                    <p>
                      {attachment.message}
                      {mode === 'server' && !user && (
                        <Link to="/login">Sign in to this application</Link>
                      )}
                    </p>
                  </div>
                )}
                {user?.role === 'admin' && (
                  <Link
                    className="fx-text-button fx-manage-attachment"
                    to={`/admin/settings?tab=attachments&number=${encodeURIComponent(submitted)}&event=${encodeURIComponent(category)}`}
                  >
                    Manage image attachments
                  </Link>
                )}
                <CarrierLink
                  href="https://www.fedex.com/en-us/customer-support/claims.html"
                  className="fx-report-link"
                >
                  <PackageSearch size={17} aria-hidden="true" />
                  Report missing package
                </CarrierLink>
              </div>
              <div className="fx-tracking-journey">
                <div className="fx-reference-heading">
                  <div>
                    <p className="fx-eyebrow">Tracking ID</p>
                    <p className="fx-reference-number">{submitted}</p>
                    {nickname && <p className="fx-shipment-nickname">{nickname}</p>}
                  </div>
                  <div className="fx-reference-actions">
                    <button
                      type="button"
                      className="fx-icon-button"
                      aria-label="Copy tracking reference"
                      onClick={() => {
                        void copyReference();
                      }}
                    >
                      <Copy size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="fx-icon-button"
                      aria-label="Add shipment nickname"
                      onClick={() => {
                        setDraftName(nickname);
                        setEditingName(true);
                      }}
                    >
                      <Pencil size={17} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`fx-icon-button ${marked ? 'is-marked' : ''}`}
                      aria-label={
                        marked ? 'Unmark reference for this visit' : 'Mark reference for this visit'
                      }
                      aria-pressed={marked}
                      onClick={() => {
                        setMarked((value) => !value);
                        setNotice(
                          marked
                            ? 'Reference unmarked.'
                            : 'Reference marked for this page visit only. No carrier account was changed.',
                        );
                      }}
                    >
                      <Star size={19} aria-hidden="true" fill={marked ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
                {shipment ? (
                  <ol className="fx-journey-list" aria-label="Public shipment progress">
                    {journeyEvents.map((event, index) => {
                      const current = event.id === currentJourneyId;
                      return (
                        <li
                          key={event.id}
                          className={`${current ? 'is-current' : ''} ${
                            current && event.status === 'on_hold' ? 'is-on-hold' : ''
                          } ${!event.recorded ? 'is-route-stage' : ''}`.trim()}
                          aria-current={current ? 'step' : undefined}
                        >
                          <span className="fx-journey-node" aria-hidden="true">
                            {current && delivered && <Check size={25} strokeWidth={2} />}
                            {current && event.status === 'on_hold' && (
                              <Pause size={24} strokeWidth={2.2} />
                            )}
                          </span>
                          <div className="fx-journey-description">
                            <h3>
                              {event.status === 'delivered'
                                ? 'Delivered'
                                : index === 0
                                  ? 'From'
                                  : shipmentStatusLabel(event.status)}
                            </h3>
                            <p>{event.location}</p>
                            {event.status === 'on_hold' && (
                              <span className="fx-hold-reason">
                                Hold issue: {holdReasonLabel(event.holdReason)}
                              </span>
                            )}
                            {event.recorded ? (
                              <>
                                {event.note && (
                                  <span className="fx-journey-detail">{event.note}</span>
                                )}
                                <time dateTime={event.at}>{formatEventTime(event.at)}</time>
                                {event.photo && (
                                  <button
                                    type="button"
                                    className="fx-journey-photo"
                                    onClick={() =>
                                      setStagePhotoView({
                                        src: event.photo,
                                        label:
                                          event.status === 'delivered'
                                            ? 'Delivery'
                                            : 'On-route',
                                      })
                                    }
                                    aria-label={`View public photo for ${shipmentStatusLabel(event.status)}`}
                                  >
                                    <img
                                      src={event.photo}
                                      alt={`Public photo recorded with the ${shipmentStatusLabel(event.status)} update`}
                                    />
                                    <span>View photo</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="fx-journey-detail">
                                Route stage completed — no separate update recorded
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="fx-muted">
                    {lookupLoading
                      ? 'Loading the public shipment timeline…'
                      : 'No timeline is available because this tracking number was not found.'}
                  </p>
                )}
              </div>
            </section>
            {carrierPanel}
            {shipment && (
              <>
                <div className="fx-full-details-action">
                  <button
                    type="button"
                    className="fx-outline-button"
                    onClick={showDetails}
                    aria-expanded={detailsOpen}
                    aria-controls="tracking-full-details"
                  >
                    {detailsOpen ? 'Hide full details' : 'See full details'}
                    {detailsOpen ? (
                      <ChevronUp size={18} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {detailsOpen && (
                  <section
                    className="fx-full-details"
                    id="tracking-full-details"
                    ref={detailsRef}
                    tabIndex={-1}
                    aria-labelledby="tracking-details-heading"
                  >
                    <h2 id="tracking-details-heading">Shipment details</h2>
                    <PublicTrackingDetails shipment={shipment} />
                  </section>
                )}
              </>
            )}
            <p className="fx-result-limit">
              {shipment
                ? 'Application shipment record only. Delivery actions and notifications are handled on the official FedEx website; nothing is submitted to the carrier here.'
                : carrierResult?.found
                  ? 'No application record matches this number. The Official FedEx API result above is a read-only carrier lookup; delivery actions remain on FedEx.'
                  : 'Only administrator-created public shipments can be tracked here. Use official FedEx tracking for a carrier shipment.'}
            </p>
          </>
        )}
      </div>
      <section className="fx-tracking-resources" aria-labelledby="tracking-resources-heading">
        <div className="fx-track-container">
          <h2 id="tracking-resources-heading">Take control of your deliveries</h2>
          <div className="fx-resource-grid">
            {[
              {
                image: siteImages.mobile,
                title: 'Tap into more convenience',
                description:
                  'Track packages, manage deliveries, and find shipping tools with the official FedEx Mobile app.',
                href: 'https://www.fedex.com/en-us/mobile.html',
                link: 'Explore the mobile app',
              },
              {
                image: siteImages.deliveryManager,
                title: 'Get deliveries your way',
                description:
                  'Explore delivery instructions, available redirects, and other options with FedEx Delivery Manager.',
                href: 'https://www.fedex.com/en-us/delivery-manager.html',
                link: 'Explore Delivery Manager',
              },
              {
                image: siteImages.pictureProof,
                title: 'Find helpful resources',
                description:
                  'Get help understanding a status, handling a door tag, or preparing for a delivery.',
                href: 'https://www.fedex.com/en-us/tracking/guide-for-tracking-managing-deliveries.html',
                link: 'Manage your deliveries',
              },
            ].map((card) => (
              <article className="fx-resource-card" key={card.title}>
                <BrandImage image={card.image} className="fx-resource-image" />
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <CarrierLink href={card.href}>{card.link}</CarrierLink>
                </div>
              </article>
            ))}
          </div>
          <div className="fx-tracking-support">
            <div>
              <h3>Not sure what your tracking status means?</h3>
              <CarrierLink href="https://www.fedex.com/en-us/tracking/guide-for-tracking-managing-deliveries.html#tracking-table">
                Check the status guide <ExternalLink size={14} aria-hidden="true" />
              </CarrierLink>
            </div>
            <div className="fx-app-links">
              <span>Track on the go</span>
              <CarrierLink href="https://apps.apple.com/app/fedex/id1010729050">
                Download for iOS
              </CarrierLink>
              <CarrierLink href="https://play.google.com/store/apps/details?id=com.fedex.ida.android">
                Download for Android
              </CarrierLink>
            </div>
          </div>
        </div>
      </section>
      <Dialog open={editingName} onOpenChange={setEditingName}>
        <DialogContent className="fx-tracking-dialog">
          <DialogTitle>Give this reference a nickname</DialogTitle>
          <DialogDescription>
            The nickname is shown on this page only. It is not saved to a FedEx account or browser
            storage.
          </DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setNickname(draftName.trim());
              setEditingName(false);
              setNotice(
                draftName.trim() ? 'Nickname updated for this page visit.' : 'Nickname removed.',
              );
            }}
          >
            <label htmlFor="shipment-nickname">Shipment nickname</label>
            <input
              id="shipment-nickname"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={40}
              autoComplete="off"
            />
            <div className="fx-dialog-actions">
              <DialogClose asChild>
                <button type="button" className="fx-text-button">
                  Cancel
                </button>
              </DialogClose>
              <button className="fx-outline-button" type="submit">
                Save nickname
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(stagePhotoView)} onOpenChange={(open) => !open && setStagePhotoView(null)}>
        <DialogContent className="fx-private-image-dialog">
          <DialogTitle>
            {stagePhotoView ? `Public ${stagePhotoView.label.toLowerCase()} photo` : 'Public photo'}
          </DialogTitle>
          <DialogDescription>
            Added by the shipment administrator to this application record—not carrier-provided
            delivery proof.
          </DialogDescription>
          {stagePhotoView && (
            <img
              src={stagePhotoView.src}
              alt={`Public ${stagePhotoView.label.toLowerCase()} photo enlarged`}
            />
          )}
          <DialogClose asChild>
            <button className="fx-outline-button" type="button">
              <X size={16} aria-hidden="true" />
              Close image
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Dialog open={imageOpen && Boolean(attachment.image)} onOpenChange={setImageOpen}>
        <DialogContent className="fx-private-image-dialog">
          <DialogTitle>Private application attachment</DialogTitle>
          <DialogDescription>
            Uploaded by the application’s administrator, not carrier-provided delivery proof. Access
            is checked by the application server.
          </DialogDescription>
          {attachment.image && <img src={attachment.image} alt="Private attachment enlarged" />}
          <DialogClose asChild>
            <button className="fx-outline-button" type="button">
              <X size={16} aria-hidden="true" />
              Close image
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
