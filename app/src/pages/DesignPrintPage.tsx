import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, FileText, Upload } from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';

const products = [
  { id: 'business-cards', name: 'Business cards', description: 'Make your next introduction count with a business card that reflects your brand.', image: siteImages.printBusinessCards, url: 'https://www.office.fedex.com/default/business-cards' },
  { id: 'posters', name: 'Posters', description: 'Bring your message to a larger canvas. Review sizes and finishing options online.', image: siteImages.printPosters, url: 'https://www.office.fedex.com/default/posters' },
  { id: 'marketing', name: 'Marketing materials', description: 'Plan brochures, flyers, and other printed materials for your business.', image: siteImages.printMarketing, url: 'https://www.office.fedex.com/default/all-print-products.html' },
  { id: 'invitations', name: 'Cards & invitations', description: 'Add a personal touch to celebrations, greetings, and special occasions.', image: siteImages.printInvitations, url: 'https://www.office.fedex.com/default/cards-invitations-photo-gifts' },
] as const;

type ProductId = typeof products[number]['id'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function DesignPrintPage() {
  const [params] = useSearchParams();
  const requestedProduct = params.get('product') || '';
  const defaultProduct = products.find((product) => product.id === requestedProduct)?.id || 'business-cards';
  // A new product URL takes precedence without an effect that overwrites user input.
  const [selection, setSelection] = useState<{ source: string; id: ProductId }>({ source: requestedProduct, id: defaultProduct });
  const productId = selection.source === requestedProduct ? selection.id : defaultProduct;
  const product = products.find((item) => item.id === productId)!;
  const [quantity, setQuantity] = useState('100');
  const [color, setColor] = useState('Full color');
  const [sides, setSides] = useState('Single sided');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [downloaded, setDownloaded] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLSelectElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const plannerRef = useRef<HTMLElement>(null);
  const signature = JSON.stringify([productId, quantity, color, sides, notes, file?.name, file?.size]);

  function planProduct(id: ProductId) {
    setSelection({ source: requestedProduct, id });
    plannerRef.current?.scrollIntoView({ block: 'start' });
    productRef.current?.focus({ preventScroll: true });
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setDownloaded('');
    const validName = /\.(pdf|png|jpe?g)$/i.test(nextFile.name);
    const validType = !nextFile.type || ['application/pdf', 'image/png', 'image/jpeg'].includes(nextFile.type);
    if (!validName || !validType || nextFile.size === 0 || nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setFileError('Choose a non-empty PDF, JPG, or PNG file up to 20 MB.');
      event.target.value = '';
      return;
    }
    setFile(nextFile);
    setFileError('');
  }

  function clearFile() {
    setFile(null);
    setFileError('');
    setDownloaded('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function downloadBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      setQuantityError('Enter a whole-number desired quantity from 1 to 10,000.');
      quantityRef.current?.focus();
      return;
    }
    setQuantityError('');
    if (fileError) { fileRef.current?.focus(); return; }
    const text = [
      'PRINT PROJECT BRIEF',
      'Independent preview — NOT a print order or price quote.',
      '',
      `Product: ${product.name}`,
      `Desired quantity: ${amount}`,
      `Color preference: ${color}`,
      `Sides preference: ${sides}`,
      `Reference file: ${file ? `${file.name} (${file.size} bytes)` : 'None selected'}`,
      '',
      `Notes: ${notes.trim() || 'None'}`,
      '',
      `Official product page: ${product.url}`,
      'Confirm actual sizes, quantities, options, prices, and availability on the official site.',
      'No file contents have been uploaded or transferred. Re-select your artwork on FedEx Office to place an order.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `print-${productId}-brief.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(signature);
  }

  return (
    <div className="service-page">
      <ServiceHero eyebrow="Design & Print" title="Bring your ideas to life" description="From a memorable business card to a bold poster, explore real FedEx Office print products and prepare a brief for your next project." image={siteImages.officePrinting}>
        <button type="button" className="brand-button brand-button-orange" onClick={() => planProduct(productId)}>Plan a print project</button>
        <button type="button" className="service-text-link" onClick={() => { plannerRef.current?.scrollIntoView({ block: 'start' }); fileRef.current?.click(); }}>Choose your file <Upload size={16} aria-hidden="true" /></button>
      </ServiceHero>
      <div className="site-container">
        <section className="service-section" aria-labelledby="print-products-title">
          <div className="service-section-heading"><div><h2 id="print-products-title">Make something that stands out</h2><p>Choose a product to start your plan. Actual print options and pricing are confirmed on FedEx Office.</p></div><ExternalLink href="https://www.office.fedex.com/default/all-print-products.html">Browse all official print products</ExternalLink></div>
          <div className="service-card-grid service-product-grid">
            {products.map((item) => <article key={item.id} className="service-card"><BrandImage image={item.image} className="service-card-image" /><div className="service-card-content"><h3>{item.name}</h3><p>{item.description}</p><button type="button" className="service-text-link" onClick={() => planProduct(item.id)} aria-label={`Plan ${item.name.toLowerCase()}`}>Plan this project <ArrowRight size={15} aria-hidden="true" /></button></div></article>)}
          </div>
        </section>

        <section id="print-project" ref={plannerRef} className="service-section service-panel" aria-labelledby="print-plan-title">
          <h2 id="print-plan-title">Prepare your print project</h2>
          <p className="service-panel-intro">Create a downloadable text brief with your preferences and optional file information.</p>
          <ServiceNotice>This planner stays in your browser tab. Files are not uploaded or sent to FedEx. A brief is not an order, artwork preview, or price quote. Use the official product page to check requirements, re-select your file, and place an order.</ServiceNotice>
          <div className="print-planner mt-7">
            <form onSubmit={downloadBrief} noValidate>
              <div className="service-form-grid">
                <div className="service-field service-field-wide"><label htmlFor="print-product">Print product</label><select id="print-product" ref={productRef} value={productId} onChange={(event) => setSelection({ source: requestedProduct, id: event.target.value as ProductId })}>{products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
                <div className="service-field"><label htmlFor="print-quantity">Desired quantity</label><input id="print-quantity" ref={quantityRef} type="number" min="1" max="10000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required aria-invalid={Boolean(quantityError)} aria-describedby={quantityError ? 'print-quantity-error' : 'print-quantity-help'} /><small id="print-quantity-help">Actual minimums vary by product.</small>{quantityError && <span id="print-quantity-error" role="alert" className="service-field-error">{quantityError}</span>}</div>
                <div className="service-field"><label htmlFor="print-color">Color preference</label><select id="print-color" value={color} onChange={(event) => setColor(event.target.value)}><option>Full color</option><option>Black & white</option></select></div>
                <div className="service-field service-field-wide"><label htmlFor="print-sides">Sides preference</label><select id="print-sides" value={sides} onChange={(event) => setSides(event.target.value)}><option>Single sided</option><option>Double sided</option></select><small>Available options are confirmed when ordering, not by this planner.</small></div>
                <div className="service-field service-field-wide"><label htmlFor="print-notes">Project notes (optional)</label><textarea id="print-notes" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Preferred size, paper, finishing, or other requirements" /></div>
              </div>
              <div className="mt-6">
                <label htmlFor="print-file" className="print-file-label"><Upload size={25} strokeWidth={1.5} aria-hidden="true" />Choose a PDF, JPG, or PNG (local only)</label>
                <input id="print-file" ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="print-file-input" onChange={chooseFile} aria-invalid={Boolean(fileError)} aria-describedby={fileError ? 'print-file-error' : 'print-file-help'} />
                <p id="print-file-help" className="service-form-help mt-3">Maximum 20 MB. Only filename, type, and size are checked; print readiness is not assessed.</p>
                {file && <p className="print-file-info" role="status"><FileText size={20} aria-hidden="true" /><span>{file.name} · {(file.size / 1024).toFixed(1)} KB<br />Selected locally. Not uploaded.</span></p>}
                {fileError && <p id="print-file-error" className="service-form-error" role="alert">{fileError}</p>}
                {(file || fileError) && <button type="button" className="service-text-link mt-3" onClick={clearFile}>Clear selected file</button>}
              </div>
              <div className="service-form-footer"><button type="submit" className="brand-button brand-button-outline"><Download size={17} aria-hidden="true" />Download project brief</button></div>
              {downloaded === signature && <p role="status" className="service-form-help mt-4">Your project brief was downloaded. No order was placed and no file was uploaded.</p>}
            </form>
            <aside className="print-brief" aria-label="Print project summary">
              <h3>Your project at a glance</h3>
              <dl><dt>Product</dt><dd>{product.name}</dd><dt>Quantity</dt><dd>{quantity || 'Not specified'}</dd><dt>Color</dt><dd>{color}</dd><dt>Sides</dt><dd>{sides}</dd><dt>File</dt><dd>{file?.name || 'None selected'}</dd></dl>
              <p>Ready to order? Open the official product page. Your file and preferences are not transferred automatically; enter them there to confirm production options and pricing.</p>
              <ExternalLink href={product.url} className="brand-button brand-button-orange">Continue at FedEx Office</ExternalLink>
              <div className="service-actions"><Link to="/support?topic=printing" className="service-text-link">Get printing help <ArrowRight size={16} aria-hidden="true" /></Link></div>
            </aside>
          </div>
        </section>

        <section className="service-section service-feature" aria-labelledby="print-help-title">
          <BrandImage image={siteImages.officeConsultation} />
          <div className="service-feature-copy"><h2 id="print-help-title">Start online. Get help in person.</h2><p>Explore online design options, or visit a FedEx Office to discuss your project and review print materials. Confirm each location’s services and hours before visiting.</p><div className="service-actions"><ExternalLink href="https://www.office.fedex.com/default/custom-printing-solutions" className="brand-button brand-button-outline">Explore design &amp; print options</ExternalLink><Link to="/locations?type=office" className="service-text-link">Find a FedEx Office <ArrowRight size={16} aria-hidden="true" /></Link></div></div>
        </section>
      </div>
    </div>
  );
}
