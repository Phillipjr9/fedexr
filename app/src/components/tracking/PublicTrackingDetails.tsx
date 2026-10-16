import { useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sampleServices } from '@/lib/shipping';
import {
  displayShipmentEvents,
  holdReasonLabel,
  placeLabel,
  shipmentStatusLabel,
} from '@/lib/publicShipments';
import type { PublicShipment } from '@/lib/workspace';

function eventDate(value: string, zone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: zone === 'local' ? undefined : zone,
  }).format(new Date(value));
}
function eventTime(value: string, zone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone === 'local' ? undefined : zone,
  }).format(new Date(value));
}
function calendarDate(value: string) {
  if (!value) return 'Not provided';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export default function PublicTrackingDetails({ shipment }: { shipment: PublicShipment }) {
  const [zone, setZone] = useState('local');
  const [oldest, setOldest] = useState(false);
  const chronological = displayShipmentEvents(shipment);
  const hasRouteStages = chronological.some((event) => !event.recorded);
  const events = oldest ? chronological : [...chronological].reverse();
  const groups = events.reduce<Record<string, typeof events>>((result, event) => {
    const date = eventDate(event.at, zone);
    (result[date] ||= []).push(event);
    return result;
  }, {});
  const service = sampleServices.find((option) => option.id === shipment.service);

  return (
    <div className="fx-detail-content">
      <Tabs defaultValue="history">
        <TabsList className="fx-detail-tabs" aria-label="Shipment detail views">
          <TabsTrigger value="history">Travel history</TabsTrigger>
          <TabsTrigger value="facts">Shipment facts</TabsTrigger>
          <TabsTrigger value="overview">Shipment overview</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="fx-detail-panel">
          <div className="fx-history-toolbar">
            <div>
              <h3>Travel history</h3>
              <p>
                {hasRouteStages
                  ? 'Administrator updates plus the completed delivery route. Stages marked “route completed” had no separate update recorded.'
                  : 'Tracking updates entered by this application’s administrator.'}
              </p>
            </div>
            <div className="fx-history-controls">
              <div className="fx-history-timezone">
                <label htmlFor="tracking-history-zone">Time zone</label>
                <select
                  id="tracking-history-zone"
                  value={zone}
                  onChange={(event) => setZone(event.target.value)}
                >
                  <option value="local">Local time</option>
                  <option value="America/New_York">Destination time (Eastern)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <button
                className="fx-text-button"
                type="button"
                onClick={() => setOldest((value) => !value)}
              >
                <ArrowDownUp size={16} aria-hidden="true" />
                {oldest ? 'Oldest first' : 'Newest first'}
              </button>
            </div>
          </div>
          <div
            className="fx-history-scroll"
            role="region"
            aria-label="Public shipment travel history"
            tabIndex={0}
          >
            <table className="fx-history-table">
              <caption className="sr-only">
                Application tracking history for {shipment.trackingNumber}. Times follow the
                selected time zone.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date / Time</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Location</th>
                </tr>
              </thead>
              {Object.entries(groups).map(([date, entries]) => (
                <tbody key={date}>
                  <tr className="fx-history-day">
                    <th scope="rowgroup" colSpan={3}>
                      {date}
                    </th>
                  </tr>
                  {entries.map((event) => (
                    <tr key={event.id}>
                      <td>
                        {event.recorded ? (
                          <time dateTime={event.at}>{eventTime(event.at, zone)}</time>
                        ) : (
                          <span aria-label="No separate update recorded">—</span>
                        )}
                      </td>
                      <td>
                        {!event.recorded
                          ? `${shipmentStatusLabel(event.status)} — route completed`
                          : event.status === 'on_hold'
                            ? `On hold — ${holdReasonLabel(event.holdReason)}${
                                event.note ? `. ${event.note}` : ''
                              }`
                            : event.note || shipmentStatusLabel(event.status)}
                        {event.photo && (
                          <img
                            className="fx-history-photo"
                            src={event.photo}
                            alt={`Public photo recorded with the ${shipmentStatusLabel(event.status)} update`}
                          />
                        )}
                      </td>
                      <td>{event.location}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </TabsContent>
        <TabsContent value="facts" className="fx-detail-panel">
          <h3>Shipment facts</h3>
          <p className="fx-muted">
            Public details supplied by the administrator. This is not a live carrier record.
          </p>
          <dl className="fx-facts-grid">
            {[
              ['Tracking number', shipment.trackingNumber],
              ['Recipient / shipment', shipment.recipientLabel],
              ['Service', service?.name || shipment.service],
              ['Weight', shipment.weight ? `${shipment.weight} lb` : 'Not provided'],
              ['Ship date', calendarDate(shipment.shipDate)],
              ['Estimated delivery', calendarDate(shipment.estimatedDelivery)],
              ['Current status', shipmentStatusLabel(shipment.status)],
              ...(shipment.status === 'on_hold'
                ? [['Current hold issue', holdReasonLabel(shipment.holdReason)]]
                : []),
              ['Current location', shipment.currentLocation],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {shipment.publicNote && <p className="fx-muted">{shipment.publicNote}</p>}
        </TabsContent>
        <TabsContent value="overview" className="fx-detail-panel">
          <h3>Shipment overview</h3>
          <p className="fx-muted">
            Route and dates entered for this application shipment. No carrier shipment was booked
            or located by this page.
          </p>
          <div className="fx-overview-route">
            <div>
              <p className="fx-eyebrow">From</p>
              <strong>
                {placeLabel(
                  shipment.originCity,
                  shipment.originRegion,
                  shipment.originPostalCode,
                ).toUpperCase()}
              </strong>
              <span>Ship date: {calendarDate(shipment.shipDate)}</span>
            </div>
            <span className="fx-route-line" aria-hidden="true" />
            <div>
              <p className="fx-eyebrow">To</p>
              <strong>
                {placeLabel(
                  shipment.destinationCity,
                  shipment.destinationRegion,
                  shipment.destinationPostalCode,
                ).toUpperCase()}
              </strong>
              <span>Estimated delivery: {calendarDate(shipment.estimatedDelivery)}</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
