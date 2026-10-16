import AlertBanner from '@/components/AlertBanner';
import TwoColumnSection from '@/components/TwoColumnSection';
import HeroSection from '@/sections/HeroSection';
import WhyShipSection from '@/sections/WhyShipSection';
import ManageDeliveriesSection from '@/sections/ManageDeliveriesSection';
import BusinessSolutionsSection from '@/sections/BusinessSolutionsSection';
import BusinessAdvantageSection from '@/sections/BusinessAdvantageSection';
import SustainabilitySection from '@/sections/SustainabilitySection';
import NoticesSection from '@/sections/NoticesSection';
import { siteImages } from '@/lib/siteAssets';

export default function HomePage() {
  return (
    <div className="home-page">
      <HeroSection />
      <AlertBanner
        message="Looking for IEEPA tariff refund updates?"
        linkText="Access the customer portal."
        linkHref="https://ieepa-refunds.fedex.com/"
      />
      <WhyShipSection />
      <ManageDeliveriesSection />
      <TwoColumnSection
        title="Go global with confidence"
        description="Your business doesn’t stop at the border. Find flexible international shipping solutions, explore delivery options, and get help preparing for your next opportunity."
        ctaText="Explore shipping services"
        ctaLink="/shipping"
        secondaryCta={{ text: 'Get a quote', link: '/rate-calculator' }}
        image={siteImages.international.src}
        imageAlt={siteImages.international.alt}
        imageWidth={siteImages.international.width}
        imageHeight={siteImages.international.height}
        imagePosition="left"
      />
      <BusinessAdvantageSection />
      <BusinessSolutionsSection />
      <SustainabilitySection />
      <NoticesSection />
    </div>
  );
}
