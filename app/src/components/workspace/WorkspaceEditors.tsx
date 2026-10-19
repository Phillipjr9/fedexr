import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useWorkspace } from '@/context/workspace';
import { generateSampleAddress, SAMPLE_ADDRESS_NOTICE } from '@/lib/addressGenerator';
import { sampleServices, localDate } from '@/lib/shipping';
import type { AddressInput, PlanInput, ShipmentPlan, WorkspaceAddress } from '@/lib/workspace';

export function useReturnFocus() {
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  return (event: Event) => {
    event.preventDefault();
    requestAnimationFrame(() => {
      if (opener && opener !== document.body && opener.isConnected) opener.focus();
      else
        document
          .querySelector<HTMLButtonElement>('.workspace-panel button:not([disabled])')
          ?.focus();
    });
  };
}

export function AddressEditor({
  record,
  initialInput,
  onClose,
  onSaved,
}: {
  record?: WorkspaceAddress;
  initialInput?: AddressInput;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { saveAddress, mode } = useWorkspace();
  const returnFocus = useReturnFocus();
  const [input, setInput] = useState<AddressInput>(
    record ||
      initialInput || {
        label: '',
        name: '',
        street: '',
        city: '',
        region: '',
        postalCode: '',
        country: 'United States',
        isDefault: false,
      },
  );
  const [generated, setGenerated] = useState(Boolean(initialInput));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await saveAddress(input, record?.id);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The address could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="workspace-dialog service-page" onCloseAutoFocus={returnFocus}>
        <DialogTitle>{record ? 'Edit saved address' : 'Add an address'}</DialogTitle>
        <DialogDescription>
          {mode === 'server'
            ? 'Saved to your account database. This does not update a FedEx address book.'
            : 'Stored only in this browser workspace. This does not update a FedEx address book.'}
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          <div className="workspace-form-grid">
            {(
              [
                ['label', 'Address label'],
                ['name', 'Recipient name'],
                ['street', 'Street address'],
                ['city', 'City'],
                ['region', 'State / region'],
                ['postalCode', 'Postal code'],
                ['country', 'Country'],
              ] as const
            ).map(([key, label]) => (
              <div
                className={`service-field ${key === 'street' ? 'workspace-field-wide' : ''}`}
                key={key}
              >
                <label htmlFor={`address-${key}`}>
                  {label}
                  {key !== 'region' && ' *'}
                </label>
                <input
                  id={`address-${key}`}
                  value={input[key]}
                  onChange={(event) =>
                    setInput((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                  maxLength={200}
                  required={key !== 'region'}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
          <label className="workspace-checkbox">
            <input
              type="checkbox"
              checked={input.isDefault}
              onChange={(event) =>
                setInput((previous) => ({ ...previous, isDefault: event.target.checked }))
              }
            />
            Use as my default address
          </label>
          <div className="workspace-generate-address">
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={() => {
                setInput((previous) => ({
                  ...generateSampleAddress(),
                  isDefault: previous.isDefault,
                }));
                setGenerated(true);
                setError('');
              }}
            >
              <Sparkles size={16} aria-hidden="true" />
              Auto-generate sample address (free)
            </button>
            {generated && (
              <p className="workspace-muted" role="status">
                {SAMPLE_ADDRESS_NOTICE}
              </p>
            )}
          </div>
          {error && (
            <p className="service-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-form-actions">
            <button type="button" className="brand-button brand-button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="brand-button workspace-primary" disabled={saving}>
              Save address
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlanEditor({
  record,
  onClose,
  onSaved,
}: {
  record?: ShipmentPlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { savePlan } = useWorkspace();
  const returnFocus = useReturnFocus();
  const [input, setInput] = useState<PlanInput>(
    record || {
      reference: '',
      recipient: '',
      from: '',
      to: '',
      weight: '1',
      service: 'ground',
      shipDate: localDate(),
      notes: '',
    },
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await savePlan(input, record?.id);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The shipment plan could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="workspace-dialog service-page" onCloseAutoFocus={returnFocus}>
        <DialogTitle>{record ? 'Edit shipment plan' : 'Create a shipment plan'}</DialogTitle>
        <DialogDescription>
          Save the recipient, route, service, and package details for this plan.
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          <div className="workspace-form-grid">
            {(
              [
                ['recipient', 'Recipient / project', 'text'],
                ['reference', 'Reference (optional)', 'text'],
                ['from', 'From ZIP code', 'text'],
                ['to', 'To ZIP code', 'text'],
                ['weight', 'Planned weight (lb)', 'number'],
                ['shipDate', 'Planned ship date', 'date'],
              ] as const
            ).map(([key, label, type]) => (
              <div className="service-field" key={key}>
                <label htmlFor={`plan-editor-${key}`}>{label}</label>
                <input
                  id={`plan-editor-${key}`}
                  type={type}
                  value={input[key]}
                  onChange={(event) =>
                    setInput((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                  maxLength={key === 'reference' ? 40 : key === 'recipient' ? 100 : 10}
                  min={
                    type === 'date'
                      ? record
                        ? undefined
                        : localDate()
                      : type === 'number'
                        ? '0.1'
                        : undefined
                  }
                  max={type === 'number' ? '150' : undefined}
                  step={type === 'number' ? '0.1' : undefined}
                  required={key !== 'reference'}
                  autoComplete="off"
                />
              </div>
            ))}
            <div className="service-field">
              <label htmlFor="plan-editor-service">Service to explore</label>
              <select
                id="plan-editor-service"
                value={input.service}
                onChange={(event) =>
                  setInput((previous) => ({
                    ...previous,
                    service: event.target.value as PlanInput['service'],
                  }))
                }
              >
                {sampleServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="service-field workspace-field-wide">
              <label htmlFor="plan-editor-notes">Planning notes (optional)</label>
              <textarea
                id="plan-editor-notes"
                rows={3}
                value={input.notes}
                onChange={(event) =>
                  setInput((previous) => ({ ...previous, notes: event.target.value }))
                }
                maxLength={1000}
              />
            </div>
          </div>
          {error && (
            <p className="service-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-form-actions">
            <button type="button" className="brand-button brand-button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="brand-button workspace-primary" disabled={saving}>
              Save shipment plan
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmRemove({
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Remove record',
  cancelLabel = 'Keep record',
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const returnFocus = useReturnFocus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The record could not be removed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="workspace-dialog service-page" onCloseAutoFocus={returnFocus}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {error && (
          <p className="workspace-feedback error" role="alert">
            {error}
          </p>
        )}
        <div className="workspace-form-actions">
          <button type="button" className="brand-button brand-button-outline" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="brand-button workspace-danger"
            onClick={remove}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
