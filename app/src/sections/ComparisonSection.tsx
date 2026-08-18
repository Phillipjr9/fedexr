import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import FadeInOnScroll from '@/components/animations/FadeInOnScroll';

export default function ComparisonSection() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeInOnScroll>
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">
            FedEx delivers to every U.S. ZIP code every weekday, while most UPS services don&apos;t
          </h2>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.1}>
          <p className="text-base text-gray-600 leading-relaxed mb-8">
            That&apos;s consistent, Monday–Friday delivery to every U.S. ZIP code. So while most UPS services only deliver three days a week in thousands of ZIP codes, FedEx has you covered.
          </p>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.2}>
          <Link
            to="/shipping"
            className="inline-flex items-center text-fedex-link font-semibold text-sm uppercase tracking-wide hover:text-fedex-link-dark transition-colors"
          >
            See why customers choose FedEx
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
