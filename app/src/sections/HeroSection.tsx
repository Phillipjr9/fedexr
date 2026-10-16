import { useRef, useState } from 'react';
import { Calculator, Package, Store, Headset, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BrandImage from '@/components/BrandImage';
import { siteImages } from '@/lib/siteAssets';

const heroSlides = [
  {
    title: 'Keep your automotive supply chain moving',
    description: 'From tires to transmissions, FedEx handles every part. Reach customers fast with flexible delivery options and logistics that scale with you.',
    ctaText: 'Gear up to ship',
    ctaLink: '/shipping',
    image: siteImages.automotive,
  },
  {
    title: 'Ship, manage, track, deliver',
    description: 'From your first shipment to your next big opportunity, find shipping solutions that keep your business moving.',
    ctaText: 'Start shipping',
    ctaLink: '/shipping/create',
    image: siteImages.ground,
  },
];

const quickActions = [
  { icon: Calculator, label: 'Get a\nquote', href: '/rate-calculator' },
  { icon: Package, label: 'Ship\nnow', href: '/shipping/create' },
  { icon: Store, label: 'Find FedEx\nlocations', href: '/locations' },
  { icon: Headset, label: 'Contact\nsupport', href: '/support' },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const trackingInput = useRef<HTMLInputElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const slide = heroSlides[currentSlide];

  function changeSlide(direction: number) {
    setCurrentSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  }

  return (
    <section className="home-hero" aria-label="Shipping services">
      <div className={`hero-stage ${currentSlide === 1 ? 'hero-stage-shipping' : ''}`}>
        <div className="hero-photograph" key={slide.image.src}>
          <BrandImage image={slide.image} className="hero-image" priority />
        </div>
        <div className="site-container hero-content">
          <div className="hero-copy" aria-live="polite" aria-atomic="true">
            <h1>{slide.title}</h1>
            <p>{slide.description}</p>
            <Link to={slide.ctaLink} className="brand-text-link">{slide.ctaText}</Link>
          </div>
          <div className="hero-controls" aria-label="Featured shipping services">
            <button type="button" onClick={() => changeSlide(-1)} aria-label="Previous featured service">
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            {heroSlides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`hero-dot ${currentSlide === index ? 'is-current' : ''}`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Show featured service ${index + 1}: ${item.title}`}
                aria-pressed={currentSlide === index}
              >
                <span />
              </button>
            ))}
            <button type="button" onClick={() => changeSlide(1)} aria-label="Next featured service">
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="site-container quick-actions-container">
        <div className="quick-actions-panel">
          <nav aria-label="Quick actions" className="quick-actions-links">
            {quickActions.map((action) => (
              <Link key={action.href} to={action.href} className="quick-action-link">
                <action.icon size={31} strokeWidth={1.4} aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            ))}
          </nav>

          <form
            className="home-tracking-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const number = trackingNumber.trim();
              if (!number) {
                setTrackingError('Please enter a tracking number.');
                trackingInput.current?.focus();
                return;
              }
              navigate({ pathname: '/tracking', search: `?${new URLSearchParams({ number })}` });
            }}
          >
            <label htmlFor="home-tracking-number" className="sr-only">Tracking number</label>
            <div className="home-tracking-fields">
              <input
                ref={trackingInput}
                id="home-tracking-number"
                name="trackingNumber"
                type="text"
                autoComplete="off"
                placeholder="Tracking number"
                value={trackingNumber}
                maxLength={50}
                required
                aria-invalid={Boolean(trackingError)}
                aria-describedby={trackingError ? 'home-tracking-error' : undefined}
                onChange={(event) => {
                  setTrackingNumber(event.target.value);
                  if (trackingError) setTrackingError('');
                }}
              />
              <button type="submit" className="brand-button brand-button-orange">Track</button>
            </div>
            {trackingError && <p id="home-tracking-error" className="tracking-error" role="alert">{trackingError}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
