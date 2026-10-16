import PromoGrid from '@/components/PromoGrid';
import { siteImages } from '@/lib/siteAssets';

export default function BusinessSolutionsSection() {
  return (
    <PromoGrid
      id="business-solutions-title"
      title="Smarter shipping for growing businesses"
      cards={[
        {
          title: 'Expand beyond borders',
          description: 'Your next customer could be anywhere. Explore shipping services and find tools to help your business reach new markets.',
          image: siteImages.globalTrade,
          ctaText: 'Get started',
          ctaLink: '/shipping',
        },
        {
          title: 'Keep your business moving',
          description: 'From everyday orders to your biggest opportunities, find reliable shipping options and delivery times that work for you.',
          image: siteImages.ground,
          ctaText: 'Get a shipping quote',
          ctaLink: '/rate-calculator',
        },
        {
          title: 'Every shipment earns more',
          description: 'Join FedEx Rewards for free and earn benefits on eligible shipping, so your business gets more from every delivery.*',
          image: siteImages.rewards,
          ctaText: 'Explore rewards',
          ctaLink: '/login',
        },
      ]}
    />
  );
}
