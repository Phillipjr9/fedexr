import { Link } from 'react-router-dom';
import FadeInOnScroll from '@/components/animations/FadeInOnScroll';

export default function NoticesSection() {
  return (
    <section className="py-8 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Rate Changes Notice */}
        <FadeInOnScroll>
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              FedEx rate and surcharge changes
            </h3>
            <p className="text-sm text-gray-600">
              Learn more about{' '}
              <Link to="/rate-calculator" className="text-fedex-link underline hover:text-fedex-link-dark">
                rate and surcharge changes
              </Link>{' '}
              —last updated 2/2/2026.
            </p>
          </div>
        </FadeInOnScroll>

        {/* Money-back Guarantee */}
        <FadeInOnScroll delay={0.1}>
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              FedEx money-back guarantee
            </h3>
            <p className="text-sm text-gray-600">
              We offer a money-back guarantee for select services. This guarantee may be suspended, modified, or revoked. Please check{' '}
              <Link to="/support" className="text-fedex-link underline hover:text-fedex-link-dark">
                money-back guarantee
              </Link>{' '}
              for the latest status of our money-back guarantee.
            </p>
          </div>
        </FadeInOnScroll>

        {/* Rewards Disclaimer */}
        <FadeInOnScroll delay={0.2}>
          <p className="text-xs text-gray-500">
            *For details, please see{' '}
            <Link to="/support" className="text-fedex-link underline hover:text-fedex-link-dark">
              FedEx Rewards Terms and Conditions
            </Link>
            .
          </p>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
