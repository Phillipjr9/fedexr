import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, LogOut, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '@/context/workspace';
import '@/workspace.css';

export interface WorkspaceSection {
  id: string;
  label: string;
  icon: ReactNode;
}
export default function WorkspaceShell({
  title,
  subtitle,
  active,
  sections,
  admin = false,
  children,
}: {
  title: string;
  subtitle: string;
  active: string;
  sections: WorkspaceSection[];
  admin?: boolean;
  children: ReactNode;
}) {
  const { data, user, signOut, mode } = useWorkspace();
  const navigate = useNavigate();
  const [accessError, setAccessError] = useState('');
  const initials = (user?.name || 'Workspace')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <div className="workspace-page service-page">
      <div className="workspace-container">
        <div className="workspace-topline">
          <Link to="/" className="service-text-link">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to website
          </Link>
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            {admin ? 'Administrator workspace' : 'Personal workspace'} ·{' '}
            {mode === 'server' ? 'Server-backed records' : 'Browser-local records'}
          </span>
        </div>
        <header className="workspace-heading">
          <div>
            <p className="service-eyebrow">{data.settings.name}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="workspace-identity">
            <span className="workspace-avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <button
              type="button"
              className="workspace-signout"
              onClick={async () => {
                try {
                  await signOut();
                  navigate(admin ? '/admin/login' : '/login');
                } catch (cause) {
                  setAccessError(
                    cause instanceof Error
                      ? cause.message
                      : 'The tab session could not be cleared. Allow session storage or close this tab.',
                  );
                }
              }}
              aria-label="Sign out of workspace"
            >
              <LogOut size={19} aria-hidden="true" />
            </button>
          </div>
        </header>
        {accessError && (
          <p className="workspace-feedback error" role="alert">
            {accessError}
          </p>
        )}
        {data.settings.announcements && (
          <p className="workspace-announcement" role="status">
            {data.settings.announcements}
          </p>
        )}
        <div className="workspace-grid">
          <aside className="workspace-sidebar">
            <nav aria-label={admin ? 'Administration sections' : 'Personal workspace sections'}>
              {sections.map((section) => (
                <Link
                  key={section.id}
                  to={`${admin ? '/admin/settings' : '/dashboard'}?tab=${section.id}`}
                  aria-current={active === section.id ? 'page' : undefined}
                >
                  {section.icon}
                  <span>{section.label}</span>
                </Link>
              ))}
            </nav>
            <div className="workspace-sidebar-note">
              <p>
                {mode === 'server'
                  ? 'Accounts and records belong to this application, not FedEx. Access is checked by the account server.'
                  : 'Data is stored in this browser, not a FedEx account. Local access does not authorize server requests.'}
              </p>
              <a
                href="https://www.fedex.com/secure-login/en-us/#/login-credentials"
                target="_blank"
                rel="noopener noreferrer"
              >
                Official FedEx account
                <ArrowUpRight size={14} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            {user?.role === 'admin' && (
              <Link className="workspace-role-switch" to={admin ? '/admin/settings' : '/admin'}>
                {admin ? 'Workspace Settings' : 'Shipment Dashboard'}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
          </aside>
          <div className="workspace-content">
            {data.truncated && (
              <p className="workspace-feedback" role="status">
                Showing the first 5,000 records per category. Totals include all records; table
                searches and exports cover displayed records only.
              </p>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
