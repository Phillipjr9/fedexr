import TwoColumnSection from '@/components/TwoColumnSection';
import { siteImages } from '@/lib/siteAssets';

export default function SustainabilitySection() {
  return (
    <TwoColumnSection
      title="Ship more responsibly"
      description="Give your packaging a second life. Explore reusable FedEx packaging and shipping supplies that help you prepare for your next delivery."
      ctaText="Explore shipping supplies"
      ctaLink="/store"
      image={siteImages.packaging.src}
      imageAlt={siteImages.packaging.alt}
      imageWidth={siteImages.packaging.width}
      imageHeight={siteImages.packaging.height}
      imagePosition="right"
      background="gray"
    />
  );
}
