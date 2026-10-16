import { Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AlertBannerProps {
  message: string;
  linkText: string;
  linkHref: string;
}

export default function AlertBanner({ message, linkText, linkHref }: AlertBannerProps) {
  const external = /^https?:\/\//.test(linkHref);
  const linkContent = <>{linkText}{external && <ExternalLink size={13} aria-hidden="true" />}</>;

  return (
    <aside className="site-container home-alert" aria-label="Shipping update">
      <Info size={29} strokeWidth={1.4} aria-hidden="true" />
      <p>
        <span>{message} </span>
        {external ? (
          <a href={linkHref} target="_blank" rel="noopener noreferrer">
            {linkContent}<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : <Link to={linkHref}>{linkContent}</Link>}
      </p>
    </aside>
  );
}
