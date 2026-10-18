import WorkspaceAccess from '@/components/workspace/WorkspaceAccess';
import AdminAccessGate from '@/components/workspace/AdminAccessGate';

export default function AdminLogin() {
  return (
    <AdminAccessGate>
      <WorkspaceAccess admin />
    </AdminAccessGate>
  );
}