import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminSettings() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    const s = localStorage.getItem('adminPassword');
    setStored(s ?? null);
  }, []);

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();

    const existing = localStorage.getItem('adminPassword') ?? 'admin';

    if (existing && current !== existing) {
      toast.error('Current password is incorrect');
      return;
    }

    if (!newPass) {
      toast.error('Enter a new password');
      return;
    }

    if (newPass !== confirm) {
      toast.error('New passwords do not match');
      return;
    }

    localStorage.setItem('adminPassword', newPass);
    setStored(newPass);
    setCurrent('');
    setNewPass('');
    setConfirm('');
    toast.success('Admin password updated');
  };

  const [uploadTracking, setUploadTracking] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    const existing = localStorage.getItem('adminPassword') ?? 'admin';
    if (existing && current !== existing) {
      toast.error('Current password is incorrect');
      return;
    }

    if (!uploadTracking.trim()) {
      toast.error('Enter a tracking number');
      return;
    }

    const input = document.getElementById('admin-image-upload') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      toast.error('Select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      (async () => {
        try {
          const resp = await fetch('/api/upload-tracking-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-secret': current,
            },
            body: JSON.stringify({ trackingNumber: uploadTracking, dataUrl }),
          });
          const json = await resp.json();
          if (!resp.ok) {
            toast.error(json?.error || 'Upload failed');
            return;
          }
          setFilePreview(dataUrl);
          toast.success('Image uploaded and attached to tracking number');
          setUploadTracking('');
          if (input) input.value = '';
        } catch (err) {
          console.error(err);
          toast.error('Upload error');
        }
      })();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-fedex-gray py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Admin Settings</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-4">Use this panel to change the admin password. Default password: <strong>admin</strong>.</p>
          <form onSubmit={handleChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="New password" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" className="bg-fedex-purple text-white">Update Password</Button>
              <div className="text-sm text-gray-500">Stored: {stored ? 'set' : 'using default'}</div>
            </div>
          </form>

          {/* Upload moved to public tracking page for admin attachments */}
        </div>
      </div>
    </div>
  );
}
