import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Package,
  ShieldCheck,
} from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { ExternalLink, ServiceNotice } from '@/components/ServiceLayout';
import { useWorkspace } from '@/context/workspace';
import { credentialError, validEmail } from '@/lib/workspace';
import { siteImages } from '@/lib/siteAssets';
import '@/workspace.css';

export default function WorkspaceAccess({ admin = false }: { admin?: boolean }) {
  const {
    data,
    user,
    signIn,
    register,
    mode,
    loading,
    serviceError,
  } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const hasOwner = data.users.some((profile) => profile.role === 'admin');
  const create = params.get('mode') === 'create';
  const server = mode === 'server';
  const creating = admin ? !server && !hasOwner : create;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const destination = admin ? '/admin' : '/admin';
  const requested = params.get('next') || '';
  const safeNext =
    requested.startsWith('/admin') ? requested : destination;

  // If not admin mode, redirect to admin login
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user && user.role === 'admin')
    return <Navigate to={safeNext} replace />;

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

  return (
    <div className="service-page workspace-access-page">
      <div className="site-container">
        <nav className="service-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Administrator access</span>
        </nav>
        <div className="workspace-access-grid">
          <div className="workspace-access-form">
            <p className="service-eyebrow">
              {creating ? 'First-time administrator setup' : 'Administrator access'}
            </p>
            <h1>
              {creating ? 'Set up your admin workspace' : 'Administrator sign-in'}
            </h1>
            <p>
              {creating
                ? 'Choose your own administrator passphrase. There is no default password.'
                : server
                  ? 'Use your server-authorized administrator account. Administrator roles are assigned privately by the server operator.'
                  : 'Sign in with your administrator credentials to manage shipments and workspace settings.'}
            </p>
            {!server && creating && (
              <ServiceNotice title="First-time administrator setup">
                No administrator exists yet. Create your administrator account with your own email
                and passphrase. There is no shared or default login. This does not create
                server-side administrator permissions.
              </ServiceNotice>
            )}
            {user?.role === 'member' && (
              <p className="workspace-access-role-note">
                You are currently signed in as a member. Administrator credentials are required for
                administration.
              </p>
            )}
            {!server && hasOwner && !creating && (
              <p className="workspace-muted" style={{ marginBottom: '1rem' }}>
                An administrator account exists. Enter your credentials to sign in, or{' '}
                <button
                  type="button"
                  className="service-text-link"
                  onClick={() => setCreate(false)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  return to sign in
                </button>
                .
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
                disabled={busy || loading || Boolean(server && serviceError)}
              >
                {busy
                  ? 'Verifying workspace access…'
                  : creating
                    ? 'Create administrator profile'
                    : 'Sign in as administrator'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
            {server && !creating && (
              <Link className="service-text-link mt-5" to="/admin/login?mode=recover">
                Forgot your workspace passphrase?
              </Link>
            )}
            <ServiceNotice
              title={server ? 'Server-backed administrator account' : 'Browser-local access'}
            >
              {server
                ? 'Your account uses server-managed sessions and a shared account database. Session credentials use an HttpOnly cookie. This does not sign in to FedEx.'
                : 'Administrator credentials and records are stored in this browser. This does not sign in to FedEx or provide server-side authorization.'}
            </ServiceNotice>
            <div className="workspace-access-links">
              <ExternalLink href="https://www.fedex.com/secure-login/en-us/#/login-credentials">
                Official FedEx sign-in
              </ExternalLink>
            </div>
          </div>
          <aside className="workspace-access-aside" aria-label="Administrator features">
            <BrandImage
              image={siteImages.ground}
              className="workspace-access-photo"
              priority
            />
            <div>
              <h2>Manage shipments and workspace.</h2>
              <p>
                Create shipment records, manage tracking, review plans, and configure the workspace
                with full administrator controls.
              </p>
              <ul>
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