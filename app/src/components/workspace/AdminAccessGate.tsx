import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { siteImages } from '@/lib/siteAssets';
import '@/workspace.css';

const STORAGE_KEY = 'fedexr:admin-access-verified';
const ACCESS_KEY = import.meta.env.VITE_ADMIN_ACCESS_KEY as string | undefined;

function isVerified(): boolean {
  if (!ACCESS_KEY) return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === ACCESS_KEY;
  } catch {
    return false;
  }
}

function storeVerified() {
  try {
    sessionStorage.setItem(STORAGE_KEY, ACCESS_KEY);
  } catch {
    /* sessionStorage unavailable; user will need to re-enter on refresh. */
  }
}

export default function AdminAccessGate({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState(isVerified);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // If no access key is configured, allow open access
  if (!ACCESS_KEY) return <>{children}</>;

  // If already verified this session, show the admin page
  if (verified) return <>{children}</>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    // Small delay to prevent brute-force timing
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (key === ACCESS_KEY) {
      storeVerified();
      setVerified(true);
    } else {
      setError('Access denied. The key is incorrect.');
    }
    setBusy(false);
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
            <p className="service-eyebrow">Restricted access</p>
            <h1>Administrator access key required</h1>
            <p>
              This area is restricted. Enter the administrator access key to continue.
            </p>
            <form onSubmit={submit} noValidate>
              <div className="service-field">
                <label htmlFor="admin-access-key">Access key</label>
                <div className="workspace-passphrase-field">
                  <input
                    id="admin-access-key"
                    type={show ? 'text' : 'password'}
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    autoComplete="off"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Hide access key' : 'Show access key'}
                    onClick={() => setShow(!show)}
                  >
                    {show ? (
                      <EyeOff size={19} aria-hidden="true" />
                    ) : (
                      <Eye size={19} aria-hidden="true" />
                    )}
                  </button>
                </div>
                <small>Contact the site owner if you do not have the access key.</small>
              </div>
              {error && (
                <p className="service-form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="brand-button workspace-primary"
                disabled={busy || !key.trim()}
              >
                {busy ? 'Verifying…' : 'Verify access key'}
                <ShieldCheck size={17} aria-hidden="true" />
              </button>
            </form>
            <p className="workspace-access-limit" style={{ marginTop: '1.5rem' }}>
              This gate protects the administrator area. It does not replace the administrator
              passphrase used to sign in after access is granted.
            </p>
          </div>
          <aside className="workspace-access-aside" aria-label="Access information">
            <BrandImage
              image={siteImages.ground}
              className="workspace-access-photo"
              priority
            />
            <div>
              <h2>Protected administrator area</h2>
              <p>
                Only authorized operators should access this area. The access key is set by the
                site owner and is separate from the administrator sign-in credentials.
              </p>
              <ul>
                <li>
                  <KeyRound size={21} aria-hidden="true" />
                  <span>Access key is required before sign-in</span>
                </li>
                <li>
                  <ShieldCheck size={21} aria-hidden="true" />
                  <span>Verified for this browser session only</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}