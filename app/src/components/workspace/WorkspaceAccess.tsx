import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  FolderOpen,
  MapPin,
  MousePointerClick,
  Package,
  Route,
  ShieldCheck,
} from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { ExternalLink, ServiceNotice } from '@/components/ServiceLayout';
import { useWorkspace } from '@/context/workspace';
import { credentialError, validEmail } from '@/lib/workspace';
import { siteImages } from '@/lib/siteAssets';
import '@/workspace.css';
import AccountRecovery from './AccountRecovery';
import { accountRequest } from '@/lib/accountApi';

export default function WorkspaceAccess({ admin = false }: { admin?: boolean }) {
  const {
    data,
    user,
    signIn,
    register,
    enterDemoAccess,
    enterAdminDemoAccess,
    mode,
    loading,
    serviceError,
  } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const hasOwner = data.users.some((profile) => profile.role === 'admin' && !profile.demo);
  const create = params.get('mode') === 'create';
  const server = mode === 'server';
  const creating = admin ? !server && !hasOwner : create;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [adminDemoBusy, setAdminDemoBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const destination = admin ? '/admin/settings' : '/dashboard';
  const requested = params.get('next') || '';
  const safeNext =
    requested.startsWith(`${destination}?`) || requested === destination ? requested : destination;
  const adminRequested =
    requested === '/admin/settings' || requested.startsWith('/admin/settings?')
      ? requested
      : '';
  const adminLoginHref = adminRequested
    ? `/admin/login?next=${encodeURIComponent(adminRequested)}`
    : '/admin/login';

  if (server && ['recover', 'reset'].includes(params.get('mode') || ''))
    return <AccountRecovery key={params.get('mode')} />;

  if (user && (!admin || user.role === 'admin'))
    return (
      <Navigate to={admin ? safeNext : user.role === 'admin' ? '/admin/settings' : safeNext} replace />
    );

  function setCreate(value: boolean) {
    const next = new URLSearchParams(params);
    if (value) next.set('mode', 'create');
    else next.delete('mode');
    setParams(next, { replace: true });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = creating
      ? credentialError(name, email, passphrase, confirm)
      : !validEmail(email)
        ? 'Enter your workspace email.'
        : !passphrase
          ? 'Enter your workspace passphrase.'
          : '';
    if (problem) {
      setError(problem);
      if (creating && !name.trim()) nameRef.current?.focus();
      else if (!validEmail(email)) emailRef.current?.focus();
      else passRef.current?.focus();
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (creating) {
        const result = await register(name, email, passphrase, admin);
        if (result?.requiresVerification) {
          setPendingEmail(email.trim().toLowerCase());
          setPassphrase('');
          setConfirm('');
          return;
        }
      } else await signIn(email, passphrase, admin ? 'admin' : 'member');
      setPassphrase('');
      setConfirm('');
      navigate(safeNext, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Workspace access could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function openDemoLogin() {
    setError('');
    setDemoBusy(true);
    try {
      await enterDemoAccess();
      navigate(safeNext, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The demo workspace could not be opened.',
      );
    } finally {
      setDemoBusy(false);
    }
  }

  async function openAdminDemoLogin() {
    setError('');
    setAdminDemoBusy(true);
    try {
      await enterAdminDemoAccess();
      navigate(admin ? safeNext : '/admin/settings', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The admin demo workspace could not be opened.',
      );
    } finally {
      setAdminDemoBusy(false);
    }
  }

  return (
    <div className="service-page workspace-access-page">
      <div className="site-container">
        <nav className="service-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{admin ? 'Administrator access' : 'Workspace access'}</span>
        </nav>
        <div className="workspace-access-grid">
          <div className="workspace-access-form">
            <p className="service-eyebrow">
              {admin
                ? creating
                  ? 'First-time administrator setup'
                  : 'Administrator access'
                : 'Your workspace'}
            </p>
            <h1>
              {admin
                ? creating
                  ? 'Set up your admin workspace'
                  : 'Administrator sign-in'
                : creating
                  ? 'Create a workspace profile'
                  : 'Welcome to your workspace'}
            </h1>
            <p>
              {admin
                ? creating
                  ? 'Choose your own administrator passphrase. There is no default password.'
                  : server
                    ? 'Use your server-authorized administrator account. Administrator roles are assigned privately by the server operator.'
                    : 'Use the administrator profile created in this browser.'
                : server
                  ? 'Keep your plans and addresses in a shared account database. This is not a FedEx account.'
                  : 'Keep shipment plans and saved addresses organized in this browser.'}
            </p>
            {admin && !server && creating && (
              <ServiceNotice title="First-time browser-local administrator setup">
                No credentialed administrator exists in this browser yet. Use the one-click admin
                login to inspect the demo administrator, or create a real local administrator
                here with your own email and passphrase; there is no shared or default login. This
                does not create server-side administrator permissions.
              </ServiceNotice>
            )}
            {admin && user?.role === 'member' && (
              <p className="workspace-access-role-note">
                You are currently signed in as a member. Administrator credentials are required for
                administration.
              </p>
            )}
            {admin && !server && !hasOwner && !pendingEmail && (
              <section className="workspace-admin-login" aria-labelledby="admin-demo-login-heading">
                <div>
                  <p className="service-eyebrow">Browser-local preview</p>
                  <h2 id="admin-demo-login-heading">Admin demo login</h2>
                  <p id="admin-demo-login-description">
                    One click opens a separate demo administrator with sample workspace profiles
                    and shipment plans to review. It is stored only in this browser and does not
                    grant server, FedEx, or private-image permissions.
                  </p>
                </div>
                <button
                  type="button"
                  className="brand-button workspace-primary workspace-admin-login-button"
                  onClick={openAdminDemoLogin}
                  disabled={busy || demoBusy || adminDemoBusy || loading}
                  aria-describedby="admin-demo-login-description"
                >
                  <ShieldCheck size={18} aria-hidden="true" />
                  {adminDemoBusy ? 'Opening admin demo…' : 'One-click admin login'}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </section>
            )}
            {!admin && !pendingEmail && (
              <div
                className="workspace-access-switch"
                role="group"
                aria-label="Workspace access mode"
              >
                <button
                  type="button"
                  aria-pressed={!creating}
                  onClick={() => {
                    setCreate(false);
                    setError('');
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  aria-pressed={creating}
                  onClick={() => {
                    setCreate(true);
                    setError('');
                  }}
                >
                  Create profile
                </button>
              </div>
            )}
            {!admin && !server && !pendingEmail && (
              <section className="workspace-demo-login" aria-labelledby="demo-login-heading">
                <div>
                  <p className="service-eyebrow">Just want to look around?</p>
                  <h2 id="demo-login-heading">Demo login</h2>
                  <p id="demo-login-description">
                    One click opens a ready-made member workspace with sample shipment plans, a
                    saved address book, and tracking links. No password or FedEx account is needed.
                  </p>
                </div>
                <button
                  type="button"
                  className="brand-button workspace-primary workspace-demo-button"
                  onClick={openDemoLogin}
                  disabled={busy || demoBusy || adminDemoBusy || loading}
                  aria-describedby="demo-login-description"
                >
                  <MousePointerClick size={18} aria-hidden="true" />
                  {demoBusy ? 'Opening demo workspace…' : 'One-click demo login'}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
                <ul aria-label="Included in the demo workspace">
                  <li>
                    <Package size={16} aria-hidden="true" /> Sample shipment plans
                  </li>
                  <li>
                    <MapPin size={16} aria-hidden="true" /> Saved addresses
                  </li>
                  <li>
                    <Route size={16} aria-hidden="true" /> Sample tracking timeline
                  </li>
                </ul>
              </section>
            )}
            {!admin && !pendingEmail && (
              <section className="workspace-admin-login" aria-labelledby="admin-login-heading">
                <div>
                  <p className="service-eyebrow">Separate administrator access</p>
                  <h2 id="admin-login-heading">Admin login</h2>
                  <p id="admin-login-description">
                    {server
                      ? 'Use an administrator account authorized by the server operator to manage shared workspace records and settings.'
                      : hasOwner
                        ? 'Use the credentialed administrator sign-in to manage workspace profiles, plans, settings, and tracking attachments.'
                        : 'Manage workspace profiles, plans, settings, and tracking attachments. Continue to the credentialed administrator setup/sign-in, or open the browser-local admin demo. There is no default password.'}
                  </p>
                </div>
                <div className="workspace-admin-login-actions">
                  <Link
                    className="brand-button brand-button-outline workspace-admin-login-button"
                    to={adminLoginHref}
                    aria-describedby="admin-login-description"
                  >
                    <ShieldCheck size={18} aria-hidden="true" />
                    Continue to admin login
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  {!server && !hasOwner && (
                    <button
                      type="button"
                      className="brand-button workspace-primary workspace-admin-login-button"
                      onClick={openAdminDemoLogin}
                      disabled={busy || demoBusy || adminDemoBusy || loading}
                      aria-describedby="admin-login-description"
                    >
                      <MousePointerClick size={18} aria-hidden="true" />
                      {adminDemoBusy ? 'Opening admin demo…' : 'One-click admin login'}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  )}
                  {!server && hasOwner && (
                    <p className="workspace-admin-demo-note">
                      One-click admin login is unavailable after a credentialed administrator has
                      been set up in this browser. Use Continue to admin login instead.
                    </p>
                  )}
                </div>
              </section>
            )}
            {pendingEmail && (
              <div className="workspace-feedback">
                <h2>Check your workspace email</h2>
                <p className="mt-4">
                  Complete email verification before signing in. If a message does not arrive, retry
                  delivery or contact the site owner. No carrier account was created.
                </p>
                <button
                  type="button"
                  className="service-text-link mt-5"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await accountRequest('/api/auth/send-verification-email', 'POST', {
                        email: pendingEmail,
                        callbackURL: `${window.location.origin}/login?verified=1`,
                      });
                      setEmailMessage(
                        'Verification delivery was requested. Check your inbox; if no message arrives, contact the site owner.',
                      );
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : 'Verification delivery could not be requested.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Request verification email again
                </button>
                <button
                  type="button"
                  className="service-text-link mt-5"
                  onClick={() => {
                    setPendingEmail('');
                    setCreate(false);
                    setEmailMessage('');
                  }}
                >
                  Return to sign-in
                </button>
              </div>
            )}
            {emailMessage && (
              <p className="workspace-feedback" role="status">
                {emailMessage}
              </p>
            )}
            {serviceError && (
              <p className="workspace-feedback error" role="alert">
                {serviceError} Server access is required; there is no browser-local fallback.
              </p>
            )}
            {!pendingEmail && (
              <form onSubmit={submit} noValidate>
                {creating && (
                  <div className="service-field">
                    <label htmlFor="workspace-name">Display name</label>
                    <input
                      id="workspace-name"
                      ref={nameRef}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={60}
                      autoComplete="nickname"
                      required
                    />
                  </div>
                )}
                <div className="service-field">
                  <label htmlFor="workspace-email">Workspace email</label>
                  <input
                    id="workspace-email"
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={160}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="service-field">
                  <label htmlFor="workspace-passphrase">
                    {creating ? 'New workspace passphrase' : 'Workspace passphrase'}
                  </label>
                  <div className="workspace-passphrase-field">
                    <input
                      id="workspace-passphrase"
                      ref={passRef}
                      type={show ? 'text' : 'password'}
                      value={passphrase}
                      onChange={(event) => setPassphrase(event.target.value)}
                      minLength={creating ? 10 : undefined}
                      maxLength={128}
                      autoComplete={creating ? 'new-password' : 'current-password'}
                      required
                      aria-describedby="workspace-passphrase-help"
                    />
                    <button
                      type="button"
                      aria-label={show ? 'Hide workspace passphrase' : 'Show workspace passphrase'}
                      onClick={() => setShow(!show)}
                    >
                      {show ? (
                        <EyeOff size={19} aria-hidden="true" />
                      ) : (
                        <Eye size={19} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <small id="workspace-passphrase-help">
                    For this independent workspace only. Never enter your FedEx password.{' '}
                    {creating && 'Use 10–128 characters.'}
                  </small>
                </div>
                {creating && (
                  <div className="service-field">
                    <label htmlFor="workspace-confirm">Confirm workspace passphrase</label>
                    <input
                      id="workspace-confirm"
                      type="password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}
                {error && (
                  <p className="service-form-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="brand-button workspace-primary"
                  disabled={busy || demoBusy || adminDemoBusy || loading || Boolean(server && serviceError)}
                >
                  {busy
                    ? 'Verifying workspace access…'
                    : creating
                      ? admin
                        ? 'Create administrator profile'
                        : 'Create workspace profile'
                      : admin
                        ? 'Sign in as administrator'
                        : 'Sign in to workspace'}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
            )}
            {pendingEmail && error && (
              <p className="workspace-feedback error" role="alert">
                {error}
              </p>
            )}
            {server && !creating && !pendingEmail && (
              <Link className="service-text-link mt-5" to="/login?mode=recover">
                Forgot your workspace passphrase?
              </Link>
            )}
            <ServiceNotice
              title={server ? 'Independent server-backed account' : 'Browser-local access'}
            >
              {server
                ? 'Your account uses server-managed sessions and a shared account database. Session credentials use an HttpOnly cookie; passphrases and tokens are not stored in localStorage or sessionStorage. This does not sign in to FedEx. Browser-local profiles from earlier visits are not server accounts and are not imported automatically.'
                : 'Profiles and passphrase-derived hashes are stored in this browser; the active session lasts in this tab. This does not sign in to FedEx or provide server-side authorization. Use a shared browser only with people you trust.'}
            </ServiceNotice>
            {server && !admin && (
              <p className="workspace-demo-server-note">
                One-click demo login is disabled when server accounts are enabled; use a verified
                workspace account instead.
              </p>
            )}
            <div className="workspace-access-links">
              <Link to={admin ? '/login' : '/admin/login'} className="service-text-link">
                {admin ? 'Personal workspace access' : 'Admin login'}
              </Link>
              <ExternalLink href="https://www.fedex.com/secure-login/en-us/#/login-credentials">
                Official FedEx sign-in
              </ExternalLink>
            </div>
          </div>
          <aside className="workspace-access-aside" aria-label="Workspace features">
            <BrandImage
              image={admin ? siteImages.ground : siteImages.rewards}
              className="workspace-access-photo"
              priority
            />
            <div>
              <h2>
                {admin ? 'Clear controls. Honest records.' : 'A little planning goes a long way.'}
              </h2>
              <p>
                {admin
                  ? server
                    ? 'Manage shared accounts, review saved plans, and configure the workspace without invented shipment or revenue totals.'
                    : 'Manage local profiles, review saved plans, and configure the workspace without invented shipment or revenue totals.'
                  : 'Save the details you need, review your next shipment plan, and come back to your address book.'}
              </p>
              <ul>
                <li>
                  <FolderOpen size={21} aria-hidden="true" />
                  <span>Saved shipment plans—not booked shipments</span>
                </li>
                <li>
                  <MapPin size={21} aria-hidden="true" />
                  <span>{admin ? 'Profile and record management' : 'Your own address book'}</span>
                </li>
                <li>
                  <ShieldCheck size={21} aria-hidden="true" />
                  <span>
                    {admin
                      ? 'Separate administrator controls'
                      : server
                        ? 'Your verified workspace account'
                        : 'Your browser-local workspace profile'}
                  </span>
                </li>
              </ul>
              <p className="workspace-access-limit">
                Live shipping, billing, rewards, and carrier accounts remain on the official FedEx
                website.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
