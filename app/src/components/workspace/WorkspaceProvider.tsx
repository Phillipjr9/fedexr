import type { ReactNode } from 'react';
import BrowserWorkspaceProvider from './BrowserWorkspaceProvider';
import ServerWorkspaceProvider from './ServerWorkspaceProvider';

// Explicit build-time opt-in: a server failure never falls back to local credentials.
export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  return import.meta.env.VITE_WORKSPACE_MODE === 'server' ? (
    <ServerWorkspaceProvider>{children}</ServerWorkspaceProvider>
  ) : (
    <BrowserWorkspaceProvider>{children}</BrowserWorkspaceProvider>
  );
}
