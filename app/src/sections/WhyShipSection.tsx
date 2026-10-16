import { Link } from 'react-router-dom';
import BrandImage from '@/components/BrandImage';
import { siteImages } from '@/lib/siteAssets';

const features = [
  {
    title: 'Innovative solutions for reliability & speed',
    description: 'Whether it’s across states or worldwide, we prioritize the secure and swift arrival of your shipments.',
  },
  {
    title: 'Premium shipping at professional rates',
    description: 'When you need reliable delivery and careful handling, trust FedEx to get your items where they need to go on time.',
  },
  {
    title: 'We ship everywhere*',
    description: 'From major cities to remote destinations, our global network helps you reach customers around the world.',
  },
  {
    title: 'Flat-rate shipping. Fewer surprises.',
    description: 'FedEx One Rate® offers predictable flat-rate overnight and 2-day shipping, so you can focus on what comes next.**',
  },
];

export default function WhyShipSection() {
  return (
    <section className="site-container why-ship-section" aria-labelledby="why-ship-title">
      <div className="why-ship-copy">
        <h2 id="why-ship-title">Why ship with FedEx?</h2>
        <div className="why-ship-features">
          {features.map((feature) => (
            <div key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
        <p className="why-ship-footnote">
          *FedEx doesn’t ship anywhere sanctioned by the U.S.<br />
          **Visit the <a href="https://www.fedex.com/en-us/shipping/one-rate.html" target="_blank" rel="noopener noreferrer">FedEx One Rate page<span className="sr-only"> (opens in a new tab)</span></a> for details.
        </p>
        <Link to="/shipping/create" className="brand-button brand-button-outline">Start shipping now</Link>
      </div>
      <BrandImage image={siteImages.professional} className="why-ship-image" />
    </section>
  );
}
