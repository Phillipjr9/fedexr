import { Link } from 'react-router-dom';

interface TwoColumnSectionProps {
  title: string;
  subtitle?: string;
  description: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCta?: { text: string; link: string };
  image: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
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
  imageWidth = 727,
  imageHeight = 463,
  imagePosition,
  background = 'white',
}: TwoColumnSectionProps) {
  return (
    <section className="site-container two-column-section">
      <div className={`feature-split image-${imagePosition} ${background === 'gray' ? 'feature-split-gray' : ''}`}>
        <div className="feature-image-wrapper">
          <img
            src={image}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className="feature-image"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="feature-copy">
          {subtitle && <p className="feature-eyebrow">{subtitle}</p>}
          <h2>{title}</h2>
          <p className="feature-description">{description}</p>
          <div className="feature-links">
            {ctaText && <Link to={ctaLink} className="brand-text-link">{ctaText}</Link>}
            {secondaryCta && <Link to={secondaryCta.link} className="brand-text-link">{secondaryCta.text}</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
