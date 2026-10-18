import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/context/workspace';

export default function ProtectedWorkspace({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, loading, serviceError } = useWorkspace();
  const location = useLocation();
  if (loading)
    return (
      <div className="site-container py-12" role="status">
        Checking account access…
      </div>
    );
  if (serviceError)
    return (
      <div className="site-container py-12">
        <h1 className="text-3xl font-light mb-5">Account service unavailable</h1>
        <p role="alert">{serviceError}</p>
        <p className="mt-5">
          A server account is required. Browser-local profiles are not used as a fallback.
        </p>
      </div>
    );
  if (!user || (admin && user.role !== 'admin')) {
    return (
      <Navigate
        replace
        to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  }
  return children;
}
