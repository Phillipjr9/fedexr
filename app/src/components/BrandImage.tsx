import type { SiteImage } from '@/lib/siteAssets';

interface BrandImageProps {
  image: SiteImage;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}

export default function BrandImage({
  image,
  className,
  priority = false,
  decorative = false,
}: BrandImageProps) {
  return (
    <img
      src={image.src}
      alt={decorative ? '' : image.alt}
      width={image.width}
      height={image.height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}
