import { Facebook, Instagram, Linkedin, Youtube, Globe, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const companyLinks = [
  { label: 'About FedEx', href: 'https://www.fedex.com/en-us/about.html' },
  { label: 'Our Portfolio', href: 'https://www.fedex.com/en-us/about/company-structure.html' },
  { label: 'Investor Relations', href: 'https://investors.fedex.com/' },
  { label: 'Careers', href: 'https://careers.fedex.com/' },
  { label: 'Corporate Responsibility', href: 'https://www.fedex.com/en-us/sustainability.html' },
  { label: 'Newsroom', href: 'https://newsroom.fedex.com/' },
];

const socialLinks = [
  { icon: Facebook, href: 'https://www.facebook.com/FedEx/', label: 'FedEx on Facebook' },
  { icon: Instagram, href: 'https://www.instagram.com/fedex/', label: 'FedEx on Instagram' },
  { icon: Linkedin, href: 'https://www.linkedin.com/company/fedex/', label: 'FedEx on LinkedIn' },
  { icon: Youtube, href: 'https://www.youtube.com/fedex', label: 'FedEx on YouTube' },
];

export default function Footer() {
  const { i18n } = useTranslation();

  return (
    <footer className="site-footer">
      <div className="site-container footer-main">
        <div className="footer-columns">
          <div className="footer-company">
            <h2>Our company</h2>
            <ul>
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
              <li>
                <Link to="/support">Contact us</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>More from FedEx</h2>
            <ul>
              <li>
                <a href="https://developer.fedex.com/" target="_blank" rel="noopener noreferrer">
                  FedEx Developer Portal<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <Link to="/store">Shipping supplies</Link>
              </li>
              <li>
                <Link to="/returns">Returns</Link>
              </li>
            </ul>
          </div>
          <div className="footer-language">
            <h2>Language</h2>
            <p>
              <Globe size={20} strokeWidth={1.3} aria-hidden="true" /> United States
            </p>
            <label htmlFor="footer-language" className="sr-only">
              Site language
            </label>
            <select
              id="footer-language"
              value={i18n.resolvedLanguage || 'en'}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </div>
        <div className="footer-social">
          <h2>Follow FedEx</h2>
          <Link to="/support" aria-label="Contact support">
            <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${social.label} (opens in a new tab)`}
            >
              <social.icon size={17} strokeWidth={1.5} aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <div className="site-container footer-bottom-inner">
          <p>© FedEx 1995–{new Date().getFullYear()}</p>
          <nav aria-label="Legal and privacy">
            <Link to="/support">Site information</Link>
            <Dialog>
              <DialogTrigger asChild>
                <button type="button">Cookie preferences</button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Cookie preferences</DialogTitle>
                <DialogDescription>
                  This site does not set advertising or analytics cookies. Server-backed accounts
                  store records in the database and use an essential HttpOnly session cookie.
                  Sign-out revokes that session; clearing browser storage does not delete server
                  records. Browser-local mode stores profiles, passphrase-derived hashes, addresses,
                  and plans in this browser; its sign-out clears only the tab session. Browser
                  storage also remembers your local supply list (product identifiers and desired
                  quantities only). Clear the supply list to remove its saved data. Return-plan
                  notes and photos stay in the current page session and are not uploaded or saved in
                  browser storage.
                </DialogDescription>
                <DialogClose asChild>
                  <button type="button" className="brand-button brand-button-outline">
                    Got it
                  </button>
                </DialogClose>
              </DialogContent>
            </Dialog>
            <a
              href="https://www.fedex.com/en-us/terms-of-use.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of use<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href="https://www.fedex.com/en-us/trust-center.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy & security<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
