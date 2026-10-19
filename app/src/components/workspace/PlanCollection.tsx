import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FilePlus2, Package, Pencil, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/context/workspace';
import { sampleServices } from '@/lib/shipping';
import type { ShipmentPlan } from '@/lib/workspace';
import { downloadText } from '@/lib/localDownloads';
import { ConfirmRemove, PlanEditor } from '@/components/workspace/WorkspaceEditors';

export default function PlanCollection({
  plans,
  admin = false,
}: {
  plans: ShipmentPlan[];
  admin?: boolean;
}) {
  const { data, updatePlanStatus, removePlan, mode } = useWorkspace();
  const [params, setParams] = useSearchParams();
  function closeEditor() {
    setEditing(null);
    if (params.has('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<ShipmentPlan | 'new' | null>(
    params.get('new') === '1' ? 'new' : null,
  );
  const [deleting, setDeleting] = useState<ShipmentPlan | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filtered = plans
    .filter(
      (plan) =>
        (status === 'all' || plan.status === status) &&
        `${plan.recipient} ${plan.reference} ${plan.from} ${plan.to}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  async function change(plan: ShipmentPlan, next: ShipmentPlan['status']) {
    try {
      await updatePlanStatus(plan.id, next);
      setMessage(
        mode === 'server'
          ? 'Planning status saved to your account. No carrier shipment was changed.'
          : 'Local planning status updated. No carrier shipment was changed.',
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The plan could not be updated.');
    }
  }
  function download() {
    downloadText(
      'shipment-plans.json',
      JSON.stringify(
        {
          records: filtered,
          note: 'Planning records only. No carrier bookings or live status information.',
        },
        null,
        2,
      ),
    );
    setMessage('Filtered shipment plans were downloaded.');
  }
  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>{admin ? 'All workspace shipment plans' : 'Your shipment plans'}</h2>
          <p>Draft, review-ready, and archived plans.</p>
        </div>
        <button
          type="button"
          className="brand-button workspace-primary"
          onClick={() => setEditing('new')}
        >
          <FilePlus2 size={17} aria-hidden="true" />
          New plan
        </button>
      </div>
      <div className="workspace-filters">
        <div className="service-field">
          <label htmlFor="workspace-plan-search">Search shipment plans</label>
          <input
            id="workspace-plan-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Recipient, reference, or ZIP code"
            maxLength={120}
          />
        </div>
        <div className="service-field">
          <label htmlFor="workspace-plan-status">Planning status</label>
          <select
            id="workspace-plan-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready to review</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button
          type="button"
          className="service-text-link"
          onClick={download}
          disabled={filtered.length === 0}
        >
          <Download size={16} aria-hidden="true" />
          Export filtered plans
        </button>
      </div>
      <p className="workspace-results" role="status">
        {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'} shown
      </p>
      {message && (
        <p className="workspace-feedback" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="workspace-feedback error" role="alert">
          {error}
        </p>
      )}
      {filtered.length === 0 ? (
        <div className="workspace-empty">
          <Package size={38} strokeWidth={1.3} aria-hidden="true" />
          <h3>
            {plans.length
              ? 'No plans match these filters'
              : 'Your next shipment starts with a plan'}
          </h3>
          <p>
            {plans.length
              ? 'Try another search or choose all statuses.'
              : 'Create a plan to organize recipient, ZIP codes, service, and package details.'}
          </p>
          {plans.length ? (
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={() => {
                setQuery('');
                setStatus('all');
              }}
            >
              Clear plan filters
            </button>
          ) : (
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={() => setEditing('new')}
            >
              Create your first plan
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="workspace-table-help" id="workspace-plan-table-help">
            On smaller screens, scroll the table horizontally to see status and actions.
          </p>
          <div className="workspace-table-wrap" aria-describedby="workspace-plan-table-help">
            <table className="workspace-table">
              <caption className="sr-only">Saved local shipment plans</caption>
              <thead>
                <tr>
                  <th scope="col">Recipient / reference</th>
                  <th scope="col">Route &amp; service</th>
                  {admin && <th scope="col">Profile</th>}
                  <th scope="col">Planned date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <strong>{plan.recipient}</strong>
                      <span>{plan.reference || `PLAN-${plan.id.slice(-8).toUpperCase()}`}</span>
                      <span>{plan.weight} lb</span>
                    </td>
                    <td>
                      {plan.from} → {plan.to}
                      <span>{sampleServices.find((entry) => entry.id === plan.service)?.name}</span>
                    </td>
                    {admin && (
                      <td>
                        {data.users.find((entry) => entry.id === plan.userId)?.name ||
                          'Workspace profile'}
                      </td>
                    )}
                    <td>{plan.shipDate}</td>
                    <td>
                      <label className="sr-only" htmlFor={`plan-status-${plan.id}`}>
                        Status for {plan.recipient}
                      </label>
                      <select
                        id={`plan-status-${plan.id}`}
                        value={plan.status}
                        onChange={(event) =>
                          change(plan, event.target.value as ShipmentPlan['status'])
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="ready">Ready to review</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td>
                      <div className="workspace-row-actions">
                        <button
                          type="button"
                          aria-label={`Edit plan for ${plan.recipient}`}
                          onClick={() => setEditing(plan)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove plan for ${plan.recipient}`}
                          onClick={() => setDeleting(plan)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <Link
                        className="service-text-link"
                        to={`/tracking${plan.reference ? `?number=${encodeURIComponent(plan.reference)}` : ''}`}
                      >
                        Track shipment
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && (
        <PlanEditor
          key={editing === 'new' ? 'new' : editing.id}
          record={editing === 'new' ? undefined : editing}
          onClose={closeEditor}
          onSaved={() => {
            setMessage(
              mode === 'server'
                ? 'Shipment plan saved to your account. No shipment was booked.'
                : 'Shipment plan saved in this browser. No shipment was booked.',
            );
            setError('');
          }}
        />
      )}
      {deleting && (
        <ConfirmRemove
          title="Remove this shipment plan?"
          description="This removes the planning record only. It does not cancel a shipment or contact a carrier."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await removePlan(deleting.id);
              setDeleting(null);
              setMessage('Local shipment plan removed.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'The record could not be removed.');
              throw cause;
            }
          }}
        />
      )}
    </section>
  );
}
