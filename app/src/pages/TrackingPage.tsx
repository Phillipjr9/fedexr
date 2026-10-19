import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Mail,
  MoreVertical,
  PackageSearch,
  Pause,
  Pencil,
  Printer,
  Search,
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
import {
  attachmentCategory,
  deliveryMapEmbed,
  deliveryMapLink,
  deliveryMapQuery,
} from '@/lib/tracking';
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
      <span className="sr-only"> (opens in a new tab)</span>
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
    document.title = 'FedEx Tracking';
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

  // Public tracking shows an image only when one was added. When present it
  // renders inline as a small card beside the status rather than as a
  // full-width banner or a file chip, and selecting it opens the enlarged view.
  const trackingPhoto = summaryStagePhoto
    ? {
        src: summaryStagePhoto,
        alt: `${summaryStageLabel.toLowerCase()} photo for this shipment`,
        caption: `${summaryStageLabel} photo added to this shipment.`,
        enlargeLabel: `Open the ${summaryStageLabel.toLowerCase()} photo full size`,
        onClick: () => setStagePhotoView({ src: summaryStagePhoto, label: summaryStageLabel }),
      }
    : attachment.image
      ? {
          src: attachment.image,
          alt: 'Shipment image',
          caption: 'Image added to this shipment.',
          enlargeLabel: 'Open the shipment image full size',
          onClick: () => setImageOpen(true),
        }
      : null;

  // Map of the place the delivered update was recorded at, shown only once the
  // shipment is delivered. The pin marks that recorded place — the delivery scan
  // location, falling back to the destination the route line publishes — so it
  // needs no geocoder and no coordinate table. Records hold no street address by
  // design, so the pin is the scan location rather than a doorstep.
  const deliveredLocation =
    delivered && shipment
      ? [...shipment.events]
          .reverse()
          .find((event) => event.status === 'delivered')
          ?.location.trim() || ''
      : '';
  const mapQuery =
    deliveredLocation || (delivered && shipment ? deliveryMapQuery(shipment) : '');
  const mapsKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const mapEmbed = mapQuery ? deliveryMapEmbed(mapQuery, mapsKey) : '';
  const mapLink = mapQuery ? deliveryMapLink(mapQuery) : '';
  // index.html sends no referrer at all, which is right for the keyless embed.
  // Google rejects a referrer-restricted key when no referrer arrives though, so
  // the keyed form sends the origin: the key is visible to every visitor in the
  // iframe URL, and an origin restriction is the only thing protecting it. The
  // tracking number itself is never in a referrer either way.
  const mapReferrerPolicy = mapsKey ? 'strict-origin-when-cross-origin' : 'no-referrer';

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
                  aria-label="Print tracking details"
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
                      Print details
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
          <p>Tracking details are recorded on this site.</p>
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
              Enter your tracking number to view shipment status.
            </p>
            {form}
            <div className="fx-entry-help">
              <Link to="/support">Need help?</Link>
            </div>
            <p className="fx-entry-limit">
              One reference at a time in this preview. Reference, TCN, and proof-of-delivery
              services open on fedex.com.
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
                    This hold reason applies to this shipment record.
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
                      ? 'This shipment is recorded as delivered.'
                      : `Current location: ${shipment.currentLocation}.`
                    : lookupLoading
                      ? 'Please wait while we look up this shipment.'
                      : 'Check the number and try again, or ask the sender to confirm it.'}
                </p>
                <p className="fx-signature-note">
                  {shipment
                    ? 'Delivery and signature details are shown as recorded for this shipment.'
                    : 'No shipment details are shown for an unmatched tracking number.'}
                </p>
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
                <CarrierLink
                  href="https://www.fedex.com/en-us/customer-support/claims.html"
                  className="fx-report-link"
                >
                  <PackageSearch size={17} aria-hidden="true" />
                  Report missing package
                </CarrierLink>
                {trackingPhoto && (
                  <figure className="fx-delivery-photo has-photo fx-photo-full">
                    <button
                      type="button"
                      className="fx-photo-full-open"
                      onClick={trackingPhoto.onClick}
                      aria-label={trackingPhoto.enlargeLabel}
                    >
                      <img src={trackingPhoto.src} alt={trackingPhoto.alt} />
                    </button>
                    <figcaption>
                      <span>{trackingPhoto.caption}</span>
                      <span className="fx-photo-full-hint">
                        Select the image to open it full size.
                      </span>
                    </figcaption>
                  </figure>
                )}
                {mapEmbed && (
                  <section className="fx-delivery-map" aria-labelledby="delivery-map-heading">
                    <h3 id="delivery-map-heading">Delivery location</h3>
                    <iframe
                      className="fx-delivery-map-frame"
                      title={`Map of the delivery location for tracking number ${submitted}`}
                      src={mapEmbed}
                      loading="lazy"
                      referrerPolicy={mapReferrerPolicy}
                    />
                    <p className="fx-delivery-map-note">
                      <span>The pin marks the place recorded with the delivered update.</span>
                      <CarrierLink href={mapLink}>Open in Google Maps</CarrierLink>
                    </p>
                  </section>
                )}
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
                            : 'Reference marked for this page visit only.',
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
                ? 'Delivery actions and notifications are handled on fedex.com.'
                : 'No shipment matches that number on this site.'}
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
                  'Track packages, manage deliveries, and find shipping tools with the FedEx Mobile app.',
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
            Added to this shipment record.
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
          <DialogTitle>Shipment image</DialogTitle>
          <DialogDescription>Added for this tracking number.</DialogDescription>
          {attachment.image && <img src={attachment.image} alt="Shipment image enlarged" />}
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
