import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = localStorage.getItem('adminPassword') ?? 'admin';
    if (password === existing) {
      // store a simple flag and navigate
      localStorage.setItem('isAdmin', 'true');
      toast.success('Admin authenticated');
      navigate('/admin/settings');
    } else {
      toast.error('Incorrect admin password');
    }
  };

  return (
    <div className="min-h-screen bg-fedex-gray flex items-center justify-center py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-xl font-semibold mb-4">Admin Login</h1>
        <p className="text-sm text-gray-600 mb-4">Enter the admin password to access admin settings.</p>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
            <Input
              name="admin-password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="bg-fedex-purple text-white">Sign in</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
