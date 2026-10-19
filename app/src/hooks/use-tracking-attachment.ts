import { useEffect, useState } from 'react';
import type { AttachmentCategory } from '@/lib/tracking';

interface AttachmentState {
  identity: string;
  image: string | null;
  message: string;
  loading: boolean;
}
export function useTrackingAttachment({
  number,
  category,
  principal,
  ready,
  server,
  revision,
}: {
  number: string;
  category: AttachmentCategory;
  principal: string;
  ready: boolean;
  server: boolean;
  revision: number;
}) {
  const identity = JSON.stringify([number, category, principal, revision]);
  const [state, setState] = useState<AttachmentState>({
    identity: '',
    image: null,
    message: '',
    loading: false,
  });
  useEffect(() => {
    if (!number || !ready) return;
    const controller = new AbortController();
    const finish = (image: string | null, message = '') => {
      if (!controller.signal.aborted) setState({ identity, image, message, loading: false });
    };
    void (async () => {
      try {
        const response = await fetch(
          `/api/get-tracking-image?number=${encodeURIComponent(number)}&event=${encodeURIComponent(category)}`,
          { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' },
        );
        if (controller.signal.aborted) return;
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const result: { access?: string; found?: boolean; dataUrl?: string } =
            await response.json();
          if (
            result.access === 'private' &&
            result.found === true &&
            typeof result.dataUrl === 'string' &&
            /^data:image\/(png|jpeg);base64,/.test(result.dataUrl) &&
            result.dataUrl.length <= 2.8 * 1024 * 1024
          )
            finish(result.dataUrl);
          else
            finish(
              null,
              'The image API did not confirm safe private access. No application image was displayed.',
            );
        } else if (response.status === 401 || response.status === 403) {
          finish(
            null,
            server
              ? 'Attachments are private. Sign in to the account explicitly assigned to the image; a tracking reference alone does not grant access.'
              : 'Attachments are private. Browser-local profiles and tracking URLs do not grant server access. The attachment panel can be used with explicitly enabled operator access.',
          );
        } else if (response.status === 404)
          finish(
            null,
            'No accessible application image was found for this reference and category.',
          );
        else
          finish(
            null,
            'The private attachment service is unavailable or needs configuration. The public tracking record above remains available.',
          );
      } catch {
        if (!controller.signal.aborted)
          finish(
            null,
            'The optional attachment service could not be reached. The public tracking record above remains available.',
          );
      }
    })();
    return () => controller.abort();
  }, [number, category, identity, ready, server]);
  if (!number || !ready) return { image: null, message: '', loading: false };
  if (state.identity !== identity) return { image: null, message: '', loading: true };
  return state;
}
