import PromoGrid from '@/components/PromoGrid';
import { siteImages } from '@/lib/siteAssets';

export default function ManageDeliveriesSection() {
  return (
    <PromoGrid
      id="manage-deliveries-title"
      title="Manage deliveries your way"
      cards={[
        {
          title: 'Stay one step ahead',
          description: 'Track shipments, receive delivery updates, and see when to expect your package. Keep your deliveries in view, wherever your day takes you.',
          image: siteImages.mobile,
          ctaText: 'Track a package',
          ctaLink: '/tracking',
        },
        {
          title: 'Get deliveries on your terms',
          description: 'A busy schedule shouldn’t get in the way of a delivery. Manage your shipments, check delivery details, and keep everything in one place.',
          image: siteImages.deliveryManager,
          ctaText: 'Manage your deliveries',
          ctaLink: '/dashboard',
        },
        {
          title: 'Ship with added confidence',
          description: 'Get enhanced visibility with Picture Proof of Delivery. See where your package was delivered and enjoy greater peace of mind.',
          image: siteImages.pictureProof,
          ctaText: 'Explore tracking',
          ctaLink: '/tracking',
        },
      ]}
    />
  );
}
