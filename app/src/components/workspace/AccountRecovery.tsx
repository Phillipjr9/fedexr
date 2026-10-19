import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { accountRequest } from '@/lib/accountApi';
import { validEmail } from '@/lib/workspace';
import { ServiceNotice } from '@/components/ServiceLayout';

export default function AccountRecovery() {
  const [params] = useSearchParams();
  const reset = params.get('mode') === 'reset';
  const [token] = useState(params.get('token') || '');
  const [email, setEmail] = useState('');
  const [phrase, setPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!reset && !validEmail(email)) {
      setError('Enter a valid workspace email.');
      return;
    }
    if (
      reset &&
      (!token ||
        token.length > 4096 ||
        phrase.length < 10 ||
        phrase.length > 128 ||
        phrase !== confirm)
    ) {
      setError(
        'Use the valid reset link from your email and matching passphrases from 10–128 characters.',
      );
      return;
    }
    setBusy(true);
    try {
      if (reset) {
        await accountRequest('/api/auth/reset-password', 'POST', { token, newPassword: phrase });
        setPhrase('');
        setConfirm('');
        setMessage(
          'Your workspace passphrase was reset. Existing sessions were revoked. Sign in again.',
        );
        window.history.replaceState(null, '', '/login?mode=reset');
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('fedexr:server-account-change');
          channel.postMessage('refresh');
          channel.close();
        }
      } else {
        await accountRequest('/api/auth/request-password-reset', 'POST', {
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/login?mode=reset`,
        });
        setMessage(
          'If an eligible account matches that email, check its inbox for recovery instructions. Delivery depends on the configured mail service. Links expire in 15 minutes.',
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The account request could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="service-page workspace-access-page">
      <div className="site-container">
        <nav className="service-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/login">Workspace access</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Account recovery</span>
        </nav>
        <section className="workspace-panel max-w-xl mx-auto">
          <p className="service-eyebrow">Workspace account</p>
          <h1 className="text-3xl font-light mb-5">
            {reset ? 'Choose a new workspace passphrase' : 'Recover workspace access'}
          </h1>
          <p className="workspace-panel-intro">
            This changes only your account on this project. It never changes a FedEx password.
          </p>
          <form onSubmit={submit} noValidate>
            {reset ? (
              <div className="workspace-stack">
                <div className="service-field">
                  <label htmlFor="recovery-phrase">New workspace passphrase</label>
                  <input
                    id="recovery-phrase"
                    type="password"
                    value={phrase}
                    onChange={(event) => setPhrase(event.target.value)}
                    autoComplete="new-password"
                    maxLength={128}
                    required
                  />
                </div>
                <div className="service-field">
                  <label htmlFor="recovery-confirm">Confirm new workspace passphrase</label>
                  <input
                    id="recovery-confirm"
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    maxLength={128}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="service-field">
                <label htmlFor="recovery-email">Workspace email</label>
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  maxLength={160}
                  required
                />
              </div>
            )}
            {error && (
              <p className="workspace-feedback error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="workspace-feedback" role="status">
                {message}
              </p>
            )}
            <div className="workspace-form-actions">
              <button
                type="submit"
                disabled={busy || Boolean(reset && message)}
                className="brand-button workspace-primary"
              >
                {busy
                  ? 'Submitting…'
                  : reset
                    ? 'Reset workspace passphrase'
                    : 'Request recovery email'}
              </button>
            </div>
          </form>
          <ServiceNotice title="Account email delivery">
            Recovery requires the configured account service and email transport. A reset link is
            single-use; no token or passphrase is saved in browser storage.
          </ServiceNotice>
          <Link to="/login" className="service-text-link mt-6">
            Back to sign-in
          </Link>
        </section>
      </div>
    </div>
  );
}
