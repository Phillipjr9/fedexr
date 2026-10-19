import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { siteImages } from '@/lib/siteAssets';
import { downloadText } from '@/lib/localDownloads';
import { filterSupplies, MAX_SUPPLY_QUANTITY, officialExpressSupplies, officialSuppliesShop, restoreSupplyList, saveSupplyList, supplyCategories, supplyListText, supplyProducts, validSupplyQuantity, type SupplyCategory, type SupplyId, type SupplySelection } from '@/lib/supplies';
import '@/commerce-pages.css';

export default function SuppliesStore() {
  const [params] = useSearchParams();
  const [cart, setCart] = useState<SupplySelection[]>(restoreSupplyList);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [category, setCategory] = useState<SupplyCategory | 'all'>(() => supplyCategories.find((entry) => entry.id === params.get('category'))?.id || 'all');
  const [query, setQuery] = useState((params.get('q') || '').slice(0, 120));
  const [drafts, setDrafts] = useState<Partial<Record<SupplyId, string>>>({});
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [downloaded, setDownloaded] = useState('');
  const productSectionRef = useRef<HTMLElement>(null);
  const products = filterSupplies(query, category);
  const signature = JSON.stringify(cart);
  const invalidDraft = cart.find((item) => drafts[item.id] !== undefined && !validSupplyQuantity(drafts[item.id]!));

  function commit(next: SupplySelection[]) {
    setCart(next);
    setStorageUnavailable(!saveSupplyList(next));
    setDownloaded('');
  }

  function add(id: SupplyId) {
    const product = supplyProducts.find((entry) => entry.id === id)!;
    const existing = cart.find((entry) => entry.id === id);
    if (existing?.quantity === MAX_SUPPLY_QUANTITY) {
      setAnnouncement(`The planning limit is ${MAX_SUPPLY_QUANTITY} for ${product.name}. Review your supply list to adjust it.`);
      return;
    }
    commit(existing ? cart.map((entry) => entry.id === id ? { ...entry, quantity: entry.quantity + 1 } : entry) : [...cart, { id, quantity: 1 }]);
    setDrafts((previous) => ({ ...previous, [id]: undefined }));
    setAnnouncement(`${product.name} added to your local supply list. No order has been placed.`);
  }

  function quantity(id: SupplyId, value: string) {
    setDrafts((previous) => ({ ...previous, [id]: value }));
    if (validSupplyQuantity(value)) commit(cart.map((entry) => entry.id === id ? { ...entry, quantity: Number(value) } : entry));
  }

  function adjust(id: SupplyId, delta: number) {
    const next = cart.map((entry) => entry.id === id ? { ...entry, quantity: Math.max(1, Math.min(MAX_SUPPLY_QUANTITY, entry.quantity + delta)) } : entry);
    setDrafts((previous) => ({ ...previous, [id]: undefined }));
    commit(next);
  }

  function remove(id: SupplyId) {
    commit(cart.filter((entry) => entry.id !== id));
    setDrafts((previous) => ({ ...previous, [id]: undefined }));
  }

  function clear() {
    commit([]);
    setDrafts({});
    setAnnouncement('Your local supply list was cleared.');
  }

  function download() {
    if (invalidDraft || cart.length === 0) return;
    downloadText('supply-planning-list.txt', supplyListText(cart));
    setDownloaded(signature);
  }

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <div className="service-page supplies-page">
        <ServiceHero eyebrow="Packaging supplies" title="Packaging for what’s next" description="Explore real packaging options, build a local supply list, and find the right place to order. Confirm sizes, quantities, eligibility, and current prices on the supplier sites." image={siteImages.officePacking}>
          <SheetTrigger asChild><button type="button" className="brand-button brand-button-orange" aria-label={`View supply list (${cart.length} selections)`}><ShoppingCart size={21} aria-hidden="true" />View supply list<span className="supply-count" aria-hidden="true">{cart.length}</span></button></SheetTrigger>
          <ExternalLink href={officialSuppliesShop}>Shop on FedEx Office</ExternalLink>
        </ServiceHero>
        <div className="site-container">
          <section className="service-section" ref={productSectionRef} aria-labelledby="supplies-catalog-title">
            <div className="service-section-heading"><div><h2 id="supplies-catalog-title">Choose what you need</h2><p>Verified product and category examples—not a live inventory or a specific size/SKU catalog.</p></div><ExternalLink href="https://www.fedex.com/en-us/shipping/packing/supplies.html">Packaging guide</ExternalLink></div>
            <div className="service-search"><label htmlFor="supplies-query"><span className="sr-only">Search packaging options</span><input id="supplies-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="Search boxes, mailers, tape, or packing help" autoComplete="off" /></label></div>
            <div className="service-filters" role="group" aria-label="Filter packaging category"><button type="button" className="service-filter" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All options</button>{supplyCategories.map((entry) => <button key={entry.id} type="button" className="service-filter" aria-pressed={category === entry.id} onClick={() => setCategory(entry.id)}>{entry.label}</button>)}</div>
            <p className="supply-results" role="status">{products.length} packaging {products.length === 1 ? 'option' : 'options'}{query ? ` matching “${query}”` : ''}</p>
            <p className="supply-announcement" role="status">{announcement}</p>
            {products.length === 0 ? <div className="service-empty"><h3>No packaging options match your filters</h3><p>Try a shorter search, show all categories, or browse the complete shop.</p><button type="button" className="brand-button brand-button-outline" onClick={() => { setQuery(''); setCategory('all'); }}>Clear packaging filters</button></div> : <div className="supply-product-grid">{products.map((product) => <article key={product.id} className="supply-product-card"><BrandImage image={product.image} className={`supply-product-image supply-image-${product.imageFit}`} /><div className="supply-product-content"><p className="supply-product-note">{product.note}</p><h3>{product.name}</h3><p>{product.description}</p><div className="supply-product-actions"><button type="button" className="brand-button brand-button-outline" onClick={() => add(product.id)} aria-label={`Add ${product.name} to supply list`}><Plus size={17} aria-hidden="true" />Add to list</button><ExternalLink href={product.url}>Options</ExternalLink></div></div></article>)}</div>}
            <ServiceNotice title="Local planning cart, not checkout">Only product identifiers and desired quantities are saved in this browser. Adding an item does not order it, reserve stock, quote a price, or book a packing service. Actual order tiers and available sizes must be checked online.</ServiceNotice>
          </section>
          <section className="service-section service-form-two-column" aria-label="Supply ordering options">
            <div className="service-panel"><h2>Using expedited services?</h2><p className="service-panel-intro mt-4">Complimentary FedEx packaging requires qualifying services and an eligible account. Custom FedEx Office packaging is a different product category and is not presented as free here.</p><ExternalLink href={officialExpressSupplies} className="brand-button brand-button-outline">Check eligibility &amp; order</ExternalLink></div>
            <div className="service-panel"><h2>Need help packing?</h2><p className="service-panel-intro mt-4">Discuss fragile or unusually shaped items with a packing specialist. Confirm services, fees, and hours with the location before visiting.</p><div className="service-actions"><ExternalLink href="https://local.fedex.com/en/packing-services">Find packing services</ExternalLink><Link to="/locations?type=office" className="service-text-link">Browse New York examples <ArrowRight size={15} aria-hidden="true" /></Link></div></div>
          </section>
        </div>
      </div>
      <SheetContent className="supply-cart service-page" side="right">
        <div className="supply-cart-header"><SheetTitle>Supply planning list</SheetTitle><SheetDescription>Local preferences only. No checkout, payment, order, or reservation takes place here.</SheetDescription></div>
        <div className="supply-cart-body">
          {cart.length === 0 ? <div className="supply-cart-empty"><ShoppingCart size={45} strokeWidth={1.3} aria-hidden="true" /><h3>Your supply list is empty</h3><p>Add packaging options to prepare your list.</p><SheetClose asChild><button type="button" className="brand-button brand-button-outline">Browse supplies</button></SheetClose></div> : <ul className="supply-cart-items">{cart.map((item) => {
            const product = supplyProducts.find((entry) => entry.id === item.id)!;
            const raw = drafts[item.id] ?? String(item.quantity);
            const invalid = !validSupplyQuantity(raw);
            return <li className="supply-cart-item" key={item.id}><BrandImage image={product.image} className="supply-cart-image" /><div className="supply-cart-item-copy"><h3>{product.name}</h3><p>Desired {product.unit}. Not an order quantity or stock commitment.</p></div><div className="supply-cart-quantity"><button type="button" disabled={item.quantity === 1 && !invalid} aria-label={`Decrease ${product.name} quantity`} onClick={() => adjust(item.id, -1)}><Minus size={16} aria-hidden="true" /></button><label htmlFor={`supply-quantity-${item.id}`} className="sr-only">Desired quantity for {product.name}</label><input id={`supply-quantity-${item.id}`} type="number" min="1" max={MAX_SUPPLY_QUANTITY} step="1" value={raw} onChange={(event) => quantity(item.id, event.target.value)} onBlur={() => { if (validSupplyQuantity(raw)) setDrafts((previous) => ({ ...previous, [item.id]: undefined })); }} aria-invalid={invalid} aria-describedby={invalid ? `supply-quantity-error-${item.id}` : undefined} /><button type="button" disabled={item.quantity === MAX_SUPPLY_QUANTITY && !invalid} aria-label={`Increase ${product.name} quantity`} onClick={() => adjust(item.id, 1)}><Plus size={16} aria-hidden="true" /></button><button type="button" className="supply-remove" aria-label={`Remove ${product.name} from supply list`} onClick={() => remove(item.id)}><Trash2 size={16} aria-hidden="true" /></button></div>{invalid && <p id={`supply-quantity-error-${item.id}`} className="service-form-error supply-quantity-error" role="alert">Enter a whole-number planning quantity from 1 to {MAX_SUPPLY_QUANTITY}.</p>}<ExternalLink href={product.url} className="service-text-link supply-cart-product-link">Check options</ExternalLink></li>;
          })}</ul>}
        </div>
        {cart.length > 0 && <div className="supply-cart-footer"><div className="supply-cart-summary"><strong>{cart.length} {cart.length === 1 ? 'selection' : 'selections'}</strong><button type="button" className="service-text-link" onClick={clear}>Clear supply list</button></div><p>Prices, supplier minimums, service eligibility, and shipping are not calculated here. Your list is not automatically transferred.</p><button type="button" disabled={Boolean(invalidDraft)} className="brand-button brand-button-outline" onClick={download}><Download size={17} aria-hidden="true" />Download supply list</button><ExternalLink href={officialSuppliesShop} className="brand-button brand-button-orange">Continue at FedEx Office</ExternalLink>{downloaded === signature && <p role="status">Your supply list was downloaded. No order was placed.</p>}</div>}
        {storageUnavailable && <p className="supply-storage-warning" role="status">Browser storage is unavailable. This list will only last in this page session; download it before leaving.</p>}
      </SheetContent>
    </Sheet>
  );
}
