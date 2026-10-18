import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Package,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { ExternalLink, ServiceNotice } from '@/components/ServiceLayout';
import { useWorkspace } from '@/context/workspace';
import { credentialError, validEmail } from '@/lib/workspace';
import { siteImages } from '@/lib/siteAssets';
import '@/workspace.css';

/**
 * Shared sign-in / sign-up screen.
 *
 * `admin` mode is the hidden administrator entrance (linked only from the
 * access-key gate, never from the public header or footer) and lands on the
 * admin dashboard. The default member mode is the public customer entrance and
 * lands on the customer dashboard.
 */
export default function WorkspaceAccess({ admin = false }: { admin?: boolean }) {
  const { data, user, signIn, register, mode, loading, serviceError } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const hasOwner = data.users.some((profile) => profile.role === 'admin');
  const create = params.get('mode') === 'create';
  const server = mode === 'server';
  const verified = params.get('verified') === '1';
  // Browser-local mode has no operator to grant the admin role, so the first
  // profile created there becomes the administrator. Server mode never allows
  // admin self-service registration.
  const creating = admin ? !server && !hasOwner : !server && create;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(verified ? 'Email verified. You can sign in now.' : '');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const destination = admin ? '/admin' : '/dashboard';
  const requested = params.get('next') || '';
  const safeNext = requested.startsWith(`${destination}`) ? requested : destination;

  // Already signed in with this entrance's access level — go straight through.
  if (user && (admin ? user.role === 'admin' : true)) return <Navigate to={safeNext} replace />;

  function setCreate(value: boolean) {
    const next = new URLSearchParams(params);
    if (value) next.set('mode', 'create');
    else next.delete('mode');
    setParams(next, { replace: true });
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = creating
      ? credentialError(name, email, passphrase, confirm)
      : !validEmail(email)
        ? 'Enter your email address.'
        : !passphrase
          ? 'Enter your password.'
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
          setPassphrase('');
          setConfirm('');
          setNotice(
            'Account created. Check your inbox for the verification link, then return here to sign in.',
          );
          return;
        }
      } else {
        await signIn(email, passphrase, admin ? 'admin' : 'member');
      }
      setPassphrase('');
      setConfirm('');
      navigate(safeNext, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : admin
            ? 'Administrator access could not be completed.'
            : 'Sign-in could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  }

  const title = creating
    ? admin
      ? 'Set up your admin workspace'
      : 'Create your account'
    : admin
      ? 'Administrator sign-in'
      : 'Sign in to your account';

  return (
    <div className="service-page workspace-access-page">
      <div className="site-container">
        <nav className="service-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{admin ? 'Administrator access' : 'Sign in'}</span>
        </nav>
        <div className="workspace-access-grid">
          <div className="workspace-access-form">
            <p className="service-eyebrow">
              {admin
                ? creating
                  ? 'First-time administrator setup'
                  : 'Administrator access'
                : creating
                  ? 'New customer account'
                  : 'Customer access'}
            </p>
            <h1>{title}</h1>
            <p>
              {creating
                ? admin
                  ? 'Choose your own administrator passphrase. There is no default password.'
                  : 'Create an account to save shipment plans, keep an address book, and follow shipments an administrator creates for you.'
                : admin
                  ? 'Sign in with your administrator credentials to manage shipments and workspace settings.'
                  : 'Sign in to reach your saved plans, address book, and shipment updates.'}
            </p>

            {!admin && !creating && (
              <p className="workspace-muted workspace-access-hint">
                New here?{' '}
                <button
                  type="button"
                  className="service-text-link"
                  onClick={() => setCreate(true)}
                >
                  Create an account
                </button>
              </p>
            )}
            {!admin && creating && (
              <p className="workspace-muted workspace-access-hint">
                Already registered?{' '}
                <button
                  type="button"
                  className="service-text-link"
                  onClick={() => setCreate(false)}
                >
                  Sign in instead
                </button>
              </p>
            )}

            {admin && !server && !hasOwner && !creating && (
              <p className="workspace-muted workspace-access-hint">
                No administrator exists in this browser yet.{' '}
                <button
                  type="button"
                  className="service-text-link"
                  onClick={() => setCreate(true)}
                >
                  Set up the administrator profile
                </button>
              </p>
            )}

            {!admin && user?.role === 'admin' && (
              <p className="workspace-access-role-note">
                You are signed in as an administrator.{' '}
                <Link to="/admin">Open the admin dashboard</Link>.
              </p>
            )}

            {notice && (
              <p className="workspace-feedback" role="status">
                {notice}
              </p>
            )}
            {serviceError && (
              <p className="workspace-feedback error" role="alert">
                {serviceError} Server access is required; there is no browser-local fallback.
              </p>
            )}

            <form onSubmit={submit} noValidate>
              {creating && (
                <div className="service-field">
                  <label htmlFor="workspace-name">Full name</label>
                  <input
                    id="workspace-name"
                    ref={nameRef}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    autoComplete="name"
                    required
                  />
                </div>
              )}
              <div className="service-field">
                <label htmlFor="workspace-email">Email address</label>
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
                  {creating ? 'Create a password' : 'Password'}
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
                    aria-label={show ? 'Hide password' : 'Show password'}
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
                  For this site only. Never enter your FedEx password.{' '}
                  {creating && 'Use 10–128 characters.'}
                </small>
              </div>
              {creating && (
                <div className="service-field">
                  <label htmlFor="workspace-confirm">Confirm password</label>
                  <input
                    id="workspace-confirm"
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    minLength={10}
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
                disabled={busy || loading || Boolean(server && serviceError)}
              >
                {busy
                  ? 'Verifying…'
                  : creating
                    ? admin
                      ? 'Create administrator profile'
                      : 'Create account'
                    : 'Sign in'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>

            {server && !creating && (
              <Link className="service-text-link mt-5" to="/account-recovery">
                Forgot your password?
              </Link>
            )}

            <ServiceNotice title={server ? 'Server-backed account' : 'Browser-local access'}>
              {server
                ? 'Accounts use server-managed sessions and a shared database. Session credentials use an HttpOnly cookie. This does not sign in to FedEx.'
                : 'Credentials and records are stored in this browser only. This does not sign in to FedEx or provide server-side authorization.'}
            </ServiceNotice>
            <div className="workspace-access-links">
              <ExternalLink href="https://www.fedex.com/secure-login/en-us/#/login-credentials">
                Official FedEx sign-in
              </ExternalLink>
            </div>
          </div>

          <aside
            className="workspace-access-aside"
            aria-label={admin ? 'Administrator features' : 'Account features'}
          >
            <BrandImage image={siteImages.ground} className="workspace-access-photo" priority />
            <div>
              <h2>
                {admin ? 'Manage shipments and the workspace.' : 'Keep every shipment in one place.'}
              </h2>
              <p>
                {admin
                  ? 'Create shipment records, manage tracking, review plans, and configure the workspace with full administrator controls.'
                  : 'Save shipment plans, store your addresses once, and follow the shipments an administrator creates for you.'}
              </p>
              <ul>
                {admin ? (
                  <>
                    <li>
                      <Package size={21} aria-hidden="true" />
                      <span>Create and manage shipment records</span>
                    </li>
                    <li>
                      <MapPin size={21} aria-hidden="true" />
                      <span>Profile and record management</span>
                    </li>
                    <li>
                      <ShieldCheck size={21} aria-hidden="true" />
                      <span>Full administrator controls</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Package size={21} aria-hidden="true" />
                      <span>Saved shipment plans</span>
                    </li>
                    <li>
                      <MapPin size={21} aria-hidden="true" />
                      <span>Personal address book</span>
                    </li>
                    <li>
                      <RouteIcon size={21} aria-hidden="true" />
                      <span>Tracking for shipments made for you</span>
                    </li>
                  </>
                )}
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
