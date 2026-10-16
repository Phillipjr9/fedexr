import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImagePlus, Upload } from 'lucide-react';
import { ServiceNotice } from '@/components/ServiceLayout';
import LocalPhotoPreview from '@/components/LocalPhotoPreview';
import { useWorkspace } from '@/context/workspace';
import { ConfirmRemove } from './WorkspaceEditors';

type Attachment = {
  number: string;
  event: string;
  mime: string;
  width?: number;
  height?: number;
  byteLength?: number;
  ownerId?: string | null;
};
type ImageResponse = {
  access?: 'private';
  ok?: boolean;
  found?: boolean;
  removed?: boolean;
  error?: string;
  attachment?: Attachment;
  dataUrl?: string;
};
type Action = 'upload' | 'load' | 'visibility' | 'remove';
const categories = ['default', 'in_transit', 'delivered', 'other'];
const safeImage = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^data:image\/(png|jpeg);base64,/.test(value) &&
  value.length <= 2.8 * 1024 * 1024;

export default function TrackingAttachments() {
  const [params] = useSearchParams();
  const { mode, user, data } = useWorkspace();
  const server = mode === 'server';
  const [number, setNumber] = useState((params.get('number') || '').slice(0, 40));
  const [eventType, setEventType] = useState(
    categories.includes(params.get('event') || '') ? params.get('event')! : 'in_transit',
  );
  const [ownerId, setOwnerId] = useState(user?.id || '');
  const [secret, setSecret] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stored, setStored] = useState<{ src?: string; attachment?: Attachment } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  function resetFeedback() {
    setStored(null);
    setSuccess('');
    setError('');
  }
  async function act(action: Action): Promise<{ ok: boolean; error?: string }> {
    if (busy) return { ok: false, error: 'Wait for the current attachment request to finish.' };
    setError('');
    setSuccess('');
    if (action === 'load') setStored(null);
    try {
      if (!/^[a-zA-Z0-9 -]{4,40}$/.test(number.trim()) || !/[a-zA-Z0-9]/.test(number))
        throw new Error(
          'Enter a 4–40 character tracking reference using letters, numbers, spaces, or hyphens.',
        );
      if (
        action === 'upload' &&
        (!file ||
          !['image/png', 'image/jpeg'].includes(file.type) ||
          file.size === 0 ||
          file.size > 2 * 1024 * 1024)
      )
        throw new Error('Choose a non-empty JPG or PNG up to 2 MB.');
      if (!server && !secret.trim())
        throw new Error(
          'Enter the server upload key configured for operator access. It is not your workspace passphrase.',
        );
      setBusy(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const reference = number.trim();
      const category = eventType;
      const headers: Record<string, string> = server ? {} : { 'x-admin-secret': secret };
      let url = '/api/upload-tracking-image';
      let method = 'POST';
      const body: Record<string, unknown> = { trackingNumber: reference, eventType: category };
      if (action === 'load') {
        url = `/api/get-tracking-image?number=${encodeURIComponent(reference)}&event=${encodeURIComponent(category)}`;
        method = 'GET';
      } else {
        headers['Content-Type'] = 'application/json';
        if (action === 'remove') method = 'DELETE';
        if (action === 'visibility') {
          method = 'PATCH';
          body.ownerId = ownerId || null;
        }
        if (action === 'upload') {
          if (server) body.ownerId = ownerId || null;
          body.dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('The selected image could not be read.'));
            reader.readAsDataURL(file!);
          });
        }
      }
      if (controller.signal.aborted) return { ok: false };
      const response = await fetch(url, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      let result: ImageResponse;
      try {
        result = await response.json();
      } catch {
        throw new Error(
          'The private attachment API is unavailable. Configure the service and review/apply the image migration before using it.',
        );
      }
      if (response.ok && result?.access !== 'private')
        throw new Error(
          'The endpoint did not confirm the private attachment API contract. Update the backend before using attachments.',
        );
      if (response.ok && action === 'load' && !safeImage(result.dataUrl))
        throw new Error('The server did not return a supported private image.');
      if (!response.ok || (action === 'load' ? result?.found !== true : result?.ok !== true))
        throw new Error(
          result?.error ||
            (response.status === 404
              ? 'No accessible attachment was found for this reference and category.'
              : `The image API rejected this request (${response.status}).`),
        );
      if (action === 'remove') {
        setStored(null);
        setSuccess(
          result.removed === false
            ? 'No saved attachment existed for this reference and category.'
            : 'Application attachment removed. Carrier delivery status was not changed.',
        );
      } else {
        const src = safeImage(result.dataUrl)
          ? result.dataUrl
          : action === 'visibility'
            ? stored?.src
            : undefined;
        setStored({ src, attachment: result.attachment });
        if (server && result.attachment && result.attachment.ownerId !== undefined)
          setOwnerId(result.attachment.ownerId || '');
        setSuccess(
          action === 'upload'
            ? 'The configured image API confirmed the private attachment was saved. Carrier delivery status was not changed.'
            : action === 'load'
              ? 'Private attachment loaded using server authorization.'
              : 'Attachment visibility was updated on the server.',
        );
      }
      setSecret('');
      if (server && action !== 'load' && typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('fedexr:server-account-change');
        channel.postMessage('refresh');
        channel.close();
      }
      if (action === 'upload' || action === 'remove') {
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      }
      return { ok: true };
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return { ok: false };
      const message =
        cause instanceof Error ? cause.message : 'The attachment request could not be completed.';
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act('upload');
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>Tracking image attachments</h2>
          <p>Private application images—not carrier-supplied delivery proof.</p>
        </div>
        <ImagePlus size={29} color="#4d148c" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <ServiceNotice
        title={server ? 'Server permissions enforced' : 'Server authorization required'}
      >
        {server
          ? 'Your server administrator session authorizes image management. Select the account allowed to view an attachment, or keep it administrators-only. A tracking reference alone does not grant access.'
          : 'Browser-local administrator access cannot authorize images. Operator-key access must be explicitly enabled on the server with a separate strong key. The key is sent in request headers only, never stored or placed in a URL, and cleared after a successful action.'}
      </ServiceNotice>
      <form onSubmit={submit} noValidate className="mt-6">
        <fieldset disabled={busy} className="min-w-0 border-0 p-0 m-0">
          <div className="workspace-form-grid">
            <div className="service-field">
              <label htmlFor="admin-image-reference">Tracking reference</label>
              <input
                id="admin-image-reference"
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value);
                  resetFeedback();
                }}
                maxLength={40}
                autoComplete="off"
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor="admin-image-event">Attachment category</label>
              <select
                id="admin-image-event"
                value={eventType}
                onChange={(event) => {
                  setEventType(event.target.value);
                  resetFeedback();
                }}
              >
                <option value="default">Default attachment</option>
                <option value="in_transit">In transit attachment</option>
                <option value="delivered">Delivered attachment</option>
                <option value="other">Other</option>
              </select>
            </div>
            {server ? (
              <div className="service-field workspace-field-wide">
                <label htmlFor="admin-image-owner">Visible to account</label>
                <select
                  id="admin-image-owner"
                  value={ownerId}
                  onChange={(event) => {
                    setOwnerId(event.target.value);
                    setSuccess('');
                  }}
                >
                  <option value="">Administrators only</option>
                  {data.users.map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                      disabled={profile.status === 'suspended'}
                    >
                      {profile.name} — {profile.email}
                      {profile.status === 'suspended'
                        ? ' (suspended)'
                        : profile.emailVerified === false
                          ? ' (verification pending)'
                          : ''}
                    </option>
                  ))}
                </select>
                <small>
                  Only the selected account and administrators can read the image. Verification is
                  still required. Loading a record restores its saved selection; changing it here
                  requires Update visibility or an upload.
                </small>
              </div>
            ) : (
              <div className="service-field workspace-field-wide">
                <label htmlFor="admin-image-key">Server upload key</label>
                <input
                  id="admin-image-key"
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  maxLength={256}
                  autoComplete="off"
                  required
                />
                <small>
                  Explicit ALLOW_LEGACY_IMAGE_KEY and separate ADMIN_SECRET configuration—not a
                  FedEx password, workspace passphrase, or account signing secret. Operator-key
                  images remain administrators-only.
                </small>
              </div>
            )}
            <div className="service-field workspace-field-wide">
              <label htmlFor="admin-image-file">Tracking image (JPG/PNG, maximum 2 MB)</label>
              <input
                id="admin-image-file"
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (!selected) return;
                  if (
                    !['image/jpeg', 'image/png'].includes(selected.type) ||
                    !selected.size ||
                    selected.size > 2 * 1024 * 1024
                  ) {
                    setFile(null);
                    event.target.value = '';
                    setError('Choose a non-empty JPG or PNG up to 2 MB.');
                  } else {
                    setFile(selected);
                    setError('');
                    setSuccess('');
                  }
                }}
              />
              <small>
                Single-frame images, at most 16 megapixels and 8192 pixels per edge. The server
                re-encodes images and removes metadata such as EXIF/GPS. Keep the original outside
                this app for official claims.
              </small>
            </div>
          </div>
          {file && (
            <div className="workspace-attachment-preview">
              <LocalPhotoPreview key={`${file.name}-${file.lastModified}`} file={file} />
              <p>
                {file.name} · {(file.size / 1024).toFixed(1)} KB · Local preview only
              </p>
            </div>
          )}
          <div className="workspace-form-actions">
            <button type="submit" disabled={busy} className="brand-button workspace-primary">
              <Upload size={17} aria-hidden="true" />
              {busy ? 'Processing private attachment…' : 'Upload through protected API'}
            </button>
            <button
              type="button"
              className="service-text-link"
              onClick={() => {
                void act('load');
              }}
              disabled={busy}
            >
              Load saved attachment
            </button>
            {server && (
              <button
                type="button"
                className="service-text-link"
                onClick={() => {
                  void act('visibility');
                }}
                disabled={busy}
              >
                Update visibility
              </button>
            )}
            <button
              type="button"
              className="service-text-link"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              Remove saved attachment
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p className="workspace-feedback error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="workspace-feedback" role="status">
          {success}
        </p>
      )}
      {stored?.src && (
        <div className="workspace-attachment-preview">
          <img
            src={stored.src}
            alt="Saved private application attachment"
            className="max-w-full rounded-md max-h-64 object-contain"
          />
          <p>
            Saved application image
            {stored.attachment?.width && stored.attachment?.height
              ? ` · ${stored.attachment.width} × ${stored.attachment.height}`
              : ''}
            {stored.attachment?.byteLength
              ? ` · ${(stored.attachment.byteLength / 1024).toFixed(1)} KB`
              : ''}
            . This does not verify a carrier delivery.
          </p>
        </div>
      )}
      {stored &&
        (server ? (
          <Link
            className="service-text-link"
            to={`/tracking?number=${encodeURIComponent(number.trim())}&event=${encodeURIComponent(eventType)}`}
          >
            View saved application attachment
          </Link>
        ) : (
          <p className="workspace-panel-intro">
            Saved images are private. To load one here again, re-enter the operator key. A
            browser-local login or a tracking URL alone cannot read it.
          </p>
        ))}
      {confirming && (
        <ConfirmRemove
          title="Remove this private attachment?"
          description={`Only this application's ${eventType.replaceAll('_', ' ')} image for ${number.trim() || 'the selected reference'} will be removed. No carrier record or delivery status is changed.`}
          onClose={() => {
            if (!busy) setConfirming(false);
          }}
          onConfirm={async () => {
            const outcome = await act('remove');
            if (!outcome.ok) throw new Error(outcome.error || 'The removal was not confirmed.');
            setConfirming(false);
          }}
        />
      )}
    </section>
  );
}
