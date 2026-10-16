import type { ReactNode } from 'react';
import { ArrowUpRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandImage from '@/components/BrandImage';
import type { SiteImage } from '@/lib/siteAssets';

interface ServiceHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  image: SiteImage;
  children?: ReactNode;
}

export function ServiceHero({ eyebrow, title, description, image, children }: ServiceHeroProps) {
  return (
    <div className="site-container">
      <nav className="service-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{eyebrow}</span>
      </nav>
      <section className="service-hero" aria-labelledby="service-page-title">
        <div className="service-hero-copy">
          <p className="service-eyebrow">{eyebrow}</p>
          <h1 id="service-page-title">{title}</h1>
          <p className="service-lead">{description}</p>
          {children && <div className="service-actions">{children}</div>}
        </div>
        <BrandImage image={image} className="service-hero-image" priority />
      </section>
    </div>
  );
}

export function ServiceNotice({ children, title = 'Service information' }: { children: ReactNode; title?: string }) {
  return (
    <aside className="service-notice" aria-label={title}>
      <Info size={21} aria-hidden="true" />
      <div><strong>{title}</strong><p>{children}</p></div>
    </aside>
  );
}

export function ExternalLink({
  href, children, className = 'service-text-link',
}: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}<ArrowUpRight size={16} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
