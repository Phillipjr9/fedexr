import { Link } from 'react-router-dom';
import BrandImage from '@/components/BrandImage';
import type { SiteImage } from '@/lib/siteAssets';

export interface PromoCard {
  title: string;
  description: string;
  image: SiteImage;
  ctaText: string;
  ctaLink: string;
}

interface PromoGridProps {
  id: string;
  title: string;
  cards: PromoCard[];
}

export default function PromoGrid({ id, title, cards }: PromoGridProps) {
  return (
    <section className="site-container promo-section" aria-labelledby={id}>
      <h2 id={id} className="home-section-title">{title}</h2>
      <div className="promo-grid">
        {cards.map((card) => (
          <article key={card.title} className="promo-card">
            <BrandImage image={card.image} className="promo-image" />
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <Link to={card.ctaLink} className="brand-text-link">{card.ctaText}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
