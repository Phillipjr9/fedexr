import { useEffect, useRef, useState } from 'react';

// Object URLs are revoked when a selected photo is removed or its owner unmounts.
export default function LocalPhotoPreview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="local-photo-preview">
      <img ref={ref} alt={`Local preview of ${file.name}`} width={240} height={160} className="local-photo-image" hidden={failed} onError={() => setFailed(true)} />
      {failed && <p className="local-photo-unavailable">Preview unavailable. Keep the original file for the submission.</p>}
    </div>
  );
}
