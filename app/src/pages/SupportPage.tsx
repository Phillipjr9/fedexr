import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, FileText, MessageCircle, Package, Phone, Printer, RotateCcw, Search, Truck } from 'lucide-react';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';
import { openAssistant } from '@/lib/chat';
import { helpArticles, searchHelp, type HelpCategory } from '@/lib/support';

const topics = [
  { id: 'tracking', label: 'Tracking & delivery', icon: Truck },
  { id: 'shipping', label: 'Shipping & pickup', icon: Package },
  { id: 'printing', label: 'Design & printing', icon: Printer },
  { id: 'returns', label: 'Returns & claims', icon: RotateCcw },
] as const;

export default function SupportPage() {
  const [params] = useSearchParams();
  const [input, setInput] = useState((params.get('q') || '').slice(0, 200));
  const [query, setQuery] = useState(input);
  const [category, setCategory] = useState<HelpCategory | 'all'>(() => topics.find((topic) => topic.id === params.get('topic'))?.id || 'all');
  const articles = searchHelp(query, category);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(input.trim());
  }

  function reset() {
    setInput('');
    setQuery('');
    setCategory('all');
  }

  return (
    <div className="service-page">
      <ServiceHero eyebrow="Customer support" title="How can we help you?" description="Find answers, explore self-service tools, and get to the right support resource for shipping, tracking, printing, and returns." image={siteImages.officeConsultation}>
        <ExternalLink href="https://www.fedex.com/en-us/customer-support.html" className="brand-button brand-button-outline">FedEx support</ExternalLink>
      </ServiceHero>
      <div className="site-container">
        <section className="service-section service-panel" aria-labelledby="help-search-title">
          <h2 id="help-search-title">Find an answer</h2>
          <p className="service-panel-intro">Search the {helpArticles.length} help articles. For a shipment or account, contact FedEx on fedex.com.</p>
          <form className="service-search" role="search" aria-label="Search help" onSubmit={search}>
            <label htmlFor="support-query"><span className="sr-only">Search help topics</span><input id="support-query" value={input} onChange={(event) => setInput(event.target.value)} type="search" maxLength={200} placeholder="Try pickup, print files, or damaged package" autoComplete="off" /></label>
            <button type="submit" className="brand-button brand-button-outline"><Search size={18} aria-hidden="true" />Search answers</button>
          </form>
          <ServiceNotice title="Support">The assistant and these articles explain this site. They do not open support cases, submit claims, or connect you to live representatives. Do not share account or payment details here.</ServiceNotice>
        </section>

        <section className="service-section" aria-labelledby="faq-title">
          <div className="service-section-heading"><div><h2 id="faq-title">Answers to common questions</h2><p>Choose a topic or search for a question.</p></div><ExternalLink href="https://www.fedex.com/en-us/customer-support/faqs.html">View FedEx FAQs</ExternalLink></div>
          <div className="service-filters" role="group" aria-label="Filter help topics">
            <button type="button" className="service-filter" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All topics</button>
            {topics.map((topic) => <button key={topic.id} type="button" className="service-filter" aria-pressed={category === topic.id} onClick={() => setCategory(topic.id)}><topic.icon size={15} className="inline mr-2" aria-hidden="true" />{topic.label}</button>)}
          </div>
          <div className="service-results-heading"><p role="status" className="text-sm">{articles.length} {articles.length === 1 ? 'answer' : 'answers'}{query ? ` matching “${query}”` : ''}</p>{(query || category !== 'all') && <button type="button" className="service-text-link" onClick={reset}>Clear filters</button>}</div>
          {articles.length === 0 ? (
            <div className="service-empty"><h3>No answers match this search</h3><p>Try a shorter question, clear the topic filter, or browse the FedEx help center.</p><button type="button" className="brand-button brand-button-outline" onClick={reset}>Show all answers</button></div>
          ) : (
            <div className="service-faq-list">{articles.map((article) => (
              <details key={article.id}>
                <summary>{article.question}</summary>
                <div className="service-faq-answer"><p>{article.answer}</p>{article.link.href.startsWith('/') ? <Link to={article.link.href} className="service-text-link">{article.link.label}<ArrowRight size={16} aria-hidden="true" /></Link> : <ExternalLink href={article.link.href}>{article.link.label}</ExternalLink>}</div>
              </details>
            ))}</div>
          )}
        </section>

        <section className="service-section" aria-labelledby="contact-title">
          <div className="service-section-heading"><div><h2 id="contact-title">Still need help?</h2><p>Choose a tool or go directly to FedEx support.</p></div></div>
          <div className="service-contact-grid">
            <article className="service-contact-card"><MessageCircle size={35} strokeWidth={1.4} aria-hidden="true" /><h3>Automated guide</h3><p>Get links to this project’s tools and FedEx resources. This is not a live FedEx agent.</p><button type="button" className="service-text-link" onClick={openAssistant}>Open assistant <ArrowRight size={16} aria-hidden="true" /></button></article>
            <article className="service-contact-card"><Phone size={35} strokeWidth={1.4} aria-hidden="true" /><h3>Contact FedEx</h3><p>Find the customer service phone number for your type of shipment or service. No unverified email or support hours are listed here.</p><ExternalLink href="https://www.fedex.com/en-us/customer-support/call-us.html">Find contact numbers</ExternalLink></article>
            <article className="service-contact-card"><FileText size={35} strokeWidth={1.4} aria-hidden="true" /><h3>Returns &amp; claims</h3><p>For a real lost or damaged shipment, use the claims process and check the required documents.</p><ExternalLink href="https://www.fedex.com/en-us/customer-support/claims.html">Go to claims</ExternalLink></article>
          </div>
        </section>
      </div>
    </div>
  );
}
