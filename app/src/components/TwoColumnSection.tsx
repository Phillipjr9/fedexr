import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeInOnScroll from './animations/FadeInOnScroll';

interface TwoColumnSectionProps {
  title: string;
  subtitle?: string;
  description: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCta?: { text: string; link: string };
  image: string;
  imageAlt: string;
  imagePosition: 'left' | 'right';
  background?: 'white' | 'gray';
}

export default function TwoColumnSection({
  title,
  subtitle,
  description,
  ctaText,
  ctaLink = '/',
  secondaryCta,
  image,
  imageAlt,
  imagePosition,
  background = 'white',
}: TwoColumnSectionProps) {
  const bgClass = background === 'gray' ? 'bg-fedex-gray' : 'bg-white';

  return (
    <section className={`py-16 md:py-20 ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid lg:grid-cols-2 gap-12 items-center ${imagePosition === 'left' ? 'lg:flex-row-reverse' : ''}`}>
          {/* Image */}
          {imagePosition === 'left' && (
            <FadeInOnScroll direction="right" className="order-2 lg:order-1">
              <div className="relative">
                <img
                  src={image}
                  alt={imageAlt}
                  className="w-full h-auto rounded-lg shadow-lg object-cover"
                  loading="lazy"
                />
              </div>
            </FadeInOnScroll>
          )}

          {/* Content */}
          <div className={imagePosition === 'left' ? 'order-1 lg:order-2' : ''}>
            <FadeInOnScroll>
              {subtitle && (
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {subtitle}
                </p>
              )}
              <h2 className="text-2xl md:text-3xl font-light text-gray-900 mb-4">
                {title}
              </h2>
            </FadeInOnScroll>

            <FadeInOnScroll delay={0.1}>
              <p className="text-base text-gray-600 leading-relaxed mb-6">
                {description}
              </p>
            </FadeInOnScroll>

            <FadeInOnScroll delay={0.2}>
              <div className="flex flex-wrap items-center gap-4">
                {ctaText && (
                  <Link
                    to={ctaLink}
                    className="inline-flex items-center text-fedex-link font-semibold text-sm uppercase tracking-wide hover:text-fedex-link-dark transition-colors"
                  >
                    {ctaText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                )}
                {secondaryCta && (
                  <Link
                    to={secondaryCta.link}
                    className="inline-flex items-center text-fedex-link font-semibold text-sm uppercase tracking-wide hover:text-fedex-link-dark transition-colors"
                  >
                    {secondaryCta.text}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                )}
              </div>
            </FadeInOnScroll>
          </div>

          {/* Image (right position) */}
          {imagePosition === 'right' && (
            <FadeInOnScroll direction="left">
              <div className="relative">
                <img
                  src={image}
                  alt={imageAlt}
                  className="w-full h-auto rounded-lg shadow-lg object-cover"
                  loading="lazy"
                />
              </div>
            </FadeInOnScroll>
          )}
        </div>
      </div>
    </section>
  );
}
