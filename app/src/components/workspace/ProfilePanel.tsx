import { useState, type FormEvent } from 'react';
import { useWorkspace } from '@/context/workspace';
import { ServiceNotice } from '@/components/ServiceLayout';

export default function ProfilePanel() {
  const { user, updateProfile, changePassphrase, mode } = useWorkspace();
  const demo = Boolean(user?.demo);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  async function profile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const notice = await updateProfile(name, email);
      setSuccess(
        notice ||
          (mode === 'server'
            ? 'Your profile was saved to the account database.'
            : 'Your workspace profile was saved in this browser.'),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The profile could not be saved.');
    }
  }
  async function credential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await changePassphrase(current, next, confirm);
      setCurrent('');
      setNext('');
      setConfirm('');
      setSuccess('Your workspace passphrase was updated. It has not changed your FedEx password.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The passphrase could not be updated.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace-stack">
      <section className="workspace-panel">
        <h2>Profile details</h2>
        <p className="workspace-panel-intro">
          Your workspace profile is separate from any carrier account.
          {demo &&
            (user?.role === 'admin'
              ? ' You are using the one-click admin demo; its email stays fixed so admin demo login can reopen it.'
              : ' You are using the one-click demo profile; its email stays fixed so demo login can reopen it.')}
        </p>
        <form onSubmit={profile} noValidate>
          <div className="workspace-form-grid">
            <div className="service-field">
              <label htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor="profile-email">Workspace email</label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={160}
                required
                disabled={demo}
                aria-describedby={demo ? 'profile-demo-email-note' : undefined}
              />
              {demo && (
                <small id="profile-demo-email-note">
                  Demo email is fixed for one-click access.
                </small>
              )}
            </div>
          </div>
          <div className="workspace-form-actions">
            <button type="submit" className="brand-button workspace-primary">
              Save profile
            </button>
          </div>
        </form>
      </section>
      <section className="workspace-panel">
        <h2>{demo ? 'Demo access' : 'Change workspace passphrase'}</h2>
        <p className="workspace-panel-intro">
          {demo
            ? user?.role === 'admin'
              ? 'One-click admin login has no passphrase and does not grant server permissions. Sign out and set up a credentialed administrator when you want passphrase-protected browser-local administration.'
              : 'One-click demo login has no passphrase and is not production authentication. Sign out and create your own workspace profile when you want passphrase-protected browser-local access.'
            : mode === 'server'
              ? 'The account server stores a passphrase hash, not a plaintext passphrase. Changing it revokes your other sessions.'
              : 'A passphrase-derived hash is saved locally. No plaintext passphrase is stored.'}
        </p>
        {!demo && (
          <form onSubmit={credential} noValidate>
          <div className="workspace-form-grid">
            {(
              [
                ['current', 'Current workspace passphrase', current, setCurrent],
                ['next', 'New workspace passphrase', next, setNext],
                ['confirm', 'Confirm new workspace passphrase', confirm, setConfirm],
              ] as const
            ).map(([key, label, value, setter]) => (
              <div key={key} className="service-field">
                <label htmlFor={`profile-${key}`}>{label}</label>
                <input
                  id={`profile-${key}`}
                  type="password"
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  maxLength={128}
                  autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                  required
                />
              </div>
            ))}
          </div>
            <div className="workspace-form-actions">
              <button type="submit" className="brand-button workspace-primary" disabled={busy}>
                {busy ? 'Updating…' : 'Update workspace passphrase'}
              </button>
            </div>
          </form>
        )}
      </section>
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
      <ServiceNotice title="Access limitations">
        {mode === 'server'
          ? 'This independent account is protected by server-managed sessions and server-enforced record access. Never reuse your FedEx password or store payment card details here. Carrier services are not connected.'
          : 'Browser-local access is not production authentication and can be changed by someone controlling this browser. Never reuse your FedEx password or store payment card details here. Live server permissions must be enforced separately.'}
      </ServiceNotice>
    </div>
  );
}
