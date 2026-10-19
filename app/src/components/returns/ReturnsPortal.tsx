import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileText, Package, QrCode, RotateCcw, Trash2, Upload } from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import LocalPhotoPreview from '@/components/LocalPhotoPreview';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';
import { downloadText } from '@/lib/localDownloads';
import { claimReasons, nextSteps, officialClaimCenter, officialReturnGuide, packageConditions, photoFileError, returnBriefText, returnLabelOptions, returnPlanErrors, returnReasons, validReference, type LocalPhoto, type ReturnMode, type ReturnPlan } from '@/lib/returns';
import '@/commerce-pages.css';

type PlanStep = 1 | 2 | 3 | 4;
const steps = ['Your package', 'Details', 'Review', 'Local brief'];
const emptyPlan = (mode: ReturnMode = 'return'): ReturnPlan => ({ mode, reference: '', label: '', reason: '', condition: '', notes: '' });

export default function ReturnsPortal() {
  const [params] = useSearchParams();
  const [step, setStep] = useState<PlanStep>(1);
  const [plan, setPlan] = useState<ReturnPlan>(() => ({ ...emptyPlan(params.get('mode') === 'claim' ? 'claim' : 'return'), reference: (params.get('number') || '').slice(0, 40) }));
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const plannerRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);
  const sequence = useRef(0);
  const reasons = plan.mode === 'claim' ? claimReasons : returnReasons;
  const destination = plan.mode === 'claim' ? officialClaimCenter : officialReturnGuide;

  useEffect(() => {
    if (previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  function update<K extends keyof ReturnPlan>(key: K, value: ReturnPlan[K]) {
    setPlan((previous) => ({ ...previous, [key]: value }));
    setAcknowledged(false);
    setDownloaded(false);
  }

  function selectMode(mode: ReturnMode) {
    setPlan((previous) => previous.mode === mode ? previous : { ...previous, mode, reason: '' });
    setErrors([]);
    setAcknowledged(false);
    setDownloaded(false);
  }

  function start(mode: ReturnMode) {
    selectMode(mode);
    setStep(1);
    plannerRef.current?.scrollIntoView({ block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }

  function continuePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 1 && step !== 2) return;
    const nextErrors = returnPlanErrors(plan, step);
    setErrors(nextErrors);
    if (nextErrors.length) {
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      // React applies aria-invalid with the error update; focus a known relevant field now.
      const target = step === 1 ? !validReference(plan.reference) ? 'return-reference' : 'return-label-printed' : !plan.reason ? 'return-reason' : 'return-condition';
      (invalid || document.getElementById(target))?.focus();
      return;
    }
    setStep(step === 1 ? 2 : 3);
  }

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length === 0) return;
    const error = selected.map(photoFileError).find(Boolean);
    if (error) { setPhotoError(error); return; }
    const unique = selected.filter((file, index) => !photos.some((photo) => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified) && selected.findIndex((other) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index);
    if (photos.length + unique.length > 3) { setPhotoError('Select at most 3 local photos. Remove a photo before adding another.'); return; }
    setPhotos((previous) => [...previous, ...unique.map((file) => ({ id: `photo-${++sequence.current}`, file }))]);
    setPhotoError(unique.length ? '' : 'This photo is already selected. No duplicate was added.');
    setAcknowledged(false);
    setDownloaded(false);
  }

  function prepareBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged) { setErrors(['Confirm that this creates a local brief only, not a return or claim submission.']); document.getElementById('return-confirm')?.focus(); return; }
    setErrors([]);
    setStep(4);
  }

  function download() {
    downloadText(`${plan.mode}-preparation-brief.txt`, returnBriefText(plan, photos));
    setDownloaded(true);
  }

  function reset() {
    setPlan(emptyPlan());
    setPhotos([]);
    setErrors([]);
    setPhotoError('');
    setAcknowledged(false);
    setDownloaded(false);
    setStep(1);
  }

  function summary() {
    return <dl className="return-summary"><dt>Plan type</dt><dd>{plan.mode === 'claim' ? 'Shipping claim preparation' : 'Retailer return preparation'}</dd><dt>Reference</dt><dd>{plan.reference.trim() || 'Not provided — no lookup performed'}</dd>{plan.mode === 'return' && <><dt>Label situation</dt><dd>{returnLabelOptions.find((option) => option.id === plan.label)?.label}</dd></>}<dt>Reason</dt><dd>{reasons.find((reason) => reason.id === plan.reason)?.label}</dd><dt>Condition</dt><dd>{packageConditions.find((condition) => condition.id === plan.condition)?.label}</dd><dt>Notes</dt><dd>{plan.notes.trim() || 'None'}</dd><dt>Photo references</dt><dd>{photos.length ? <ul>{photos.map((photo) => <li key={photo.id}>{photo.file.name} · {(photo.file.size / 1024).toFixed(1)} KB</li>)}</ul> : 'None selected'}</dd></dl>;
  }

  return (
    <div className="service-page returns-page">
      <ServiceHero eyebrow="Returns & Claims" title="Make your next step simpler" description="Returning an item or preparing a shipping claim? Organize your notes here, then use the retailer’s instructions or the FedEx tools to take the next step." image={siteImages.returnsKiosk}>
        <button type="button" className="brand-button brand-button-orange" onClick={() => start('return')}>Prepare a return brief</button>
        <button type="button" className="service-text-link" onClick={() => start('claim')}>Prepare a claim brief <ArrowRight size={16} aria-hidden="true" /></button>
      </ServiceHero>
      <div className="site-container">
        <section className="service-section" aria-labelledby="return-options-title">
          <div className="service-section-heading"><div><h2 id="return-options-title">Which return situation fits?</h2><p>Follow the retailer’s instructions. Label, QR code, packaging, and drop-off requirements can differ by return program.</p></div></div>
          <div className="service-card-grid return-option-grid">
            <article className="service-card"><div className="service-card-content"><FileText className="service-card-icon" size={36} strokeWidth={1.4} aria-hidden="true" /><h3>Already have a label?</h3><p>Use the retailer’s label and check its packing instructions before dropping off your package.</p><ExternalLink href="https://local.fedex.com/en-us">Find drop-off locations</ExternalLink></div></article>
            <article className="service-card"><div className="service-card-content"><QrCode className="service-card-icon" size={36} strokeWidth={1.4} aria-hidden="true" /><h3>Have a retailer QR code?</h3><p>Check the retailer’s email for participating locations and whether you need to bring a box.</p><ExternalLink href={`${officialReturnGuide}#qRcodereturns`}>View QR return guidance</ExternalLink></div></article>
            <article className="service-card"><div className="service-card-content"><Package className="service-card-icon" size={36} strokeWidth={1.4} aria-hidden="true" /><h3>Need a return label?</h3><p>Contact the retailer about its return policy first. A shipping label is not issued here.</p><ExternalLink href="https://www.fedex.com/lite/lite-ship.html">Explore label creation</ExternalLink></div></article>
          </div>
        </section>

        <section className="service-section service-panel return-planner" ref={plannerRef} aria-labelledby="return-plan-heading">
          <ServiceNotice title="Preparation, not a submission">No shipment is looked up, no return or claim is filed, and no email, refund, label, or resolution date is promised. Use reference details only. Selected photos stay in this tab and are never uploaded by this planner.</ServiceNotice>
          <ol className="return-stepper" aria-label="Preparation progress">{steps.map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} data-complete={step > index + 1}><span className="return-step-number" aria-hidden="true">{step > index + 1 ? <Check size={17} /> : index + 1}</span><span>{label}</span></li>)}</ol>
          <h2 id="return-plan-heading" ref={headingRef} tabIndex={-1}>{step === 1 ? 'Tell us about your package' : step === 2 ? 'Add details and local photos' : step === 3 ? 'Review your preparation brief' : 'Your local brief is ready'}</h2>
          {(step === 1 || step === 2) && <form ref={formRef} onSubmit={continuePlan} noValidate className="return-step-form">
            {step === 1 ? <>
              <fieldset className="return-fieldset"><legend>What would you like to prepare?</legend><div className="return-mode-grid">{(['return', 'claim'] as const).map((mode) => <label key={mode} className="return-radio-card"><input type="radio" name="return-mode" value={mode} checked={plan.mode === mode} onChange={() => selectMode(mode)} /><span><strong>{mode === 'return' ? 'Return to a retailer' : 'Shipping claim notes'}</strong><small>{mode === 'return' ? 'Follow the retailer’s policy and return instructions.' : 'Check FedEx eligibility and filing requirements.'}</small></span></label>)}</div></fieldset>
              <div className="service-field"><label htmlFor="return-reference">Tracking number or reference (optional)</label><input id="return-reference" value={plan.reference} onChange={(event) => update('reference', event.target.value)} maxLength={40} autoComplete="off" placeholder="e.g., EXAMPLE-12345" aria-invalid={errors.length > 0 && !validReference(plan.reference)} aria-describedby="return-reference-help" /><small id="return-reference-help">4–40 letters, numbers, spaces, or hyphens. This is stored in your local brief, not checked against a carrier database.</small></div>
              {plan.mode === 'return' && <fieldset className="return-fieldset"><legend>Do you have a return label?</legend><div className="return-label-grid">{returnLabelOptions.map((option) => <label key={option.id} className="return-radio-card"><input id={`return-label-${option.id}`} type="radio" name="return-label" value={option.id} checked={plan.label === option.id} onChange={() => update('label', option.id)} aria-invalid={errors.length > 0 && !plan.label} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></fieldset>}
            </> : <>
              <div className="service-form-two-column"><div className="service-field"><label htmlFor="return-reason">{plan.mode === 'claim' ? 'Claim preparation reason' : 'Return reason'}</label><select id="return-reason" value={plan.reason} onChange={(event) => update('reason', event.target.value)} required aria-invalid={errors.length > 0 && !plan.reason}><option value="">Choose a reason</option>{reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</select></div><div className="service-field"><label htmlFor="return-condition">Package condition</label><select id="return-condition" value={plan.condition} onChange={(event) => update('condition', event.target.value)} required aria-invalid={errors.length > 0 && !plan.condition}><option value="">Choose a condition</option>{packageConditions.map((condition) => <option key={condition.id} value={condition.id}>{condition.label}</option>)}</select></div></div>
              <div className="service-field mt-6"><label htmlFor="return-notes">Notes (optional)</label><textarea id="return-notes" rows={4} maxLength={1000} value={plan.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Describe the issue using reference details. Do not include passwords or payment information." /></div>
              <div className="return-photo-section"><label htmlFor="return-photos" className="print-file-label"><Upload size={24} strokeWidth={1.4} aria-hidden="true" />Choose local reference photos</label><input id="return-photos" ref={photoRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple className="print-file-input" onChange={choosePhotos} aria-describedby="return-photo-help" aria-invalid={Boolean(photoError)} /><p id="return-photo-help" className="service-form-help mt-3">Up to 3 JPG/PNG photos, maximum 10 MB each. Filename/type/size are checked; image contents and claim eligibility are not validated. No photo is uploaded or saved in browser storage.</p>{photoError && <p className="service-form-error" role="alert">{photoError}</p>}{photos.length > 0 && <><p className="service-form-help mt-3" role="status">{photos.length} local {photos.length === 1 ? 'photo' : 'photos'} selected. Nothing uploaded.</p><div className="return-photo-grid">{photos.map((photo) => <div className="return-photo-card" key={photo.id}><LocalPhotoPreview file={photo.file} /><div><p>{photo.file.name}</p><button type="button" className="service-text-link" aria-label={`Remove local photo ${photo.file.name}`} onClick={() => { setPhotos((previous) => previous.filter((entry) => entry.id !== photo.id)); setPhotoError(''); setAcknowledged(false); }}><Trash2 size={14} aria-hidden="true" />Remove photo</button></div></div>)}</div></>}</div>
            </>}
            {errors.length > 0 && <div className="service-form-error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
            <div className="return-navigation">{step === 2 && <button type="button" className="brand-button brand-button-outline" onClick={() => { setErrors([]); setStep(1); }}><ArrowLeft size={16} aria-hidden="true" />Back</button>}<button type="submit" className="brand-button brand-button-outline">{step === 1 ? 'Continue to details' : 'Review local brief'}<ArrowRight size={16} aria-hidden="true" /></button></div>
          </form>}

          {step === 3 && <form className="return-review" onSubmit={prepareBrief} noValidate>{summary()}<div className="return-next-steps"><h3>What happens next?</h3><ol>{nextSteps(plan).map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></div><label className="return-acknowledgement" htmlFor="return-confirm"><input id="return-confirm" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I understand this only prepares a local brief. Nothing is submitted and no label or refund is issued.</span></label>{errors.length > 0 && <p className="service-form-error" role="alert">{errors[0]}</p>}<div className="return-navigation"><button type="button" className="brand-button brand-button-outline" onClick={() => { setErrors([]); setStep(2); }}><ArrowLeft size={16} aria-hidden="true" />Edit details</button><button type="submit" className="brand-button brand-button-orange">Prepare local brief <ArrowRight size={16} aria-hidden="true" /></button></div></form>}

          {step === 4 && <div className="return-ready"><div className="return-ready-message" role="status"><CheckCircle2 size={33} strokeWidth={1.4} aria-hidden="true" /><p>Your notes are ready—not submitted. No return ID, claim number, email confirmation, shipping label, or refund has been created.</p></div>{summary()}<div className="return-navigation"><button type="button" className="brand-button brand-button-outline" onClick={download}><Download size={17} aria-hidden="true" />Download {plan.mode} brief</button><ExternalLink href={destination} className="brand-button brand-button-orange">{plan.mode === 'claim' ? 'Open FedEx claim center' : 'Continue with return guidance'}</ExternalLink></div><p className="service-form-help mt-4">Your notes and photos are not transferred automatically. Sign in and provide the required information on fedex.com.</p>{downloaded && <p role="status" className="service-form-help mt-4">Your {plan.mode} brief was downloaded. It contains text and photo filenames only—not uploaded image contents or a submission.</p>}<div className="service-actions"><button type="button" className="service-text-link" onClick={() => { setAcknowledged(false); setStep(2); }}>Edit this plan</button><button type="button" className="service-text-link" onClick={reset}><RotateCcw size={15} aria-hidden="true" />Start a new plan</button><Link to={plan.reference.trim() ? `/tracking?number=${encodeURIComponent(plan.reference.trim())}` : '/tracking'} className="service-text-link">View tracking <ArrowRight size={15} aria-hidden="true" /></Link></div></div>}
        </section>

        <section className="service-section service-feature" aria-labelledby="returns-packaging-title"><BrandImage image={siteImages.packaging} /><div className="service-feature-copy"><h2 id="returns-packaging-title">Check whether your packaging is reusable</h2><p>If your shipment came in packaging marked reusable, follow its instructions and use an unused adhesive strip where applicable. Confirm that it is suitable for your actual return and service.</p><div className="service-actions"><ExternalLink href="https://www.fedex.com/en-us/shipping/packing/supplies/sustainable-packaging.html" className="brand-button brand-button-outline">Explore reusable packaging</ExternalLink><Link to="/store" className="service-text-link">Build a local supplies list <ArrowRight size={15} aria-hidden="true" /></Link></div></div></section>
        <section className="service-section service-panel"><h2>Need help with a shipment?</h2><p className="service-panel-intro mt-4">Use FedEx support for eligibility, case status, and current filing deadlines.</p><div className="service-actions"><ExternalLink href="https://www.fedex.com/en-us/customer-support/claims.html">Claims information</ExternalLink><Link to="/support?topic=returns" className="service-text-link">Browse local return help <ArrowRight size={15} aria-hidden="true" /></Link></div></section>
      </div>
    </div>
  );
}
