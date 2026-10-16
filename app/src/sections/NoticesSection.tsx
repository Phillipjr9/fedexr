import { Link } from 'react-router-dom';

export default function NoticesSection() {
  return (
    <section className="site-container home-notices" aria-label="Shipping service notices">
      <div>
        <h3>FedEx rate and surcharge changes</h3>
        <p>Learn more about <Link to="/rate-calculator">rate and surcharge changes</Link>.</p>
      </div>
      <div>
        <h3>FedEx money-back guarantee</h3>
        <p>
          We offer a money-back guarantee for select services. This guarantee may be suspended,
          modified, or revoked. Please check the{' '}
          <a href="https://www.fedex.com/en-us/service-guide/money-back-guarantee.html" target="_blank" rel="noopener noreferrer">
            money-back guarantee<span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          for its latest status.
        </p>
      </div>
      <p className="rewards-footnote">
        *For details, please see{' '}
        <a href="https://www.fedex.com/en-us/rewards/termsandconditions.html" target="_blank" rel="noopener noreferrer">
          FedEx Rewards Terms and Conditions<span className="sr-only"> (opens in a new tab)</span>
        </a>.
      </p>
    </section>
  );
}
