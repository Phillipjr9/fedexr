export type HelpCategory = 'tracking' | 'shipping' | 'printing' | 'returns';

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  question: string;
  answer: string;
  keywords: string;
  link: { label: string; href: string };
}

// Help articles. FedEx links point at the live services.
export const helpArticles: HelpArticle[] = [
  {
    id: 'track-package', category: 'tracking', question: 'How do I track a package?',
    answer: 'Enter a tracking number on our tracking page. Results shown there are entered on this site, not scanned by a carrier. For a live shipment, use the FedEx tracking page.',
    keywords: 'parcel status delivery tracking number',
    link: { label: 'View tracking', href: '/tracking' },
  },
  {
    id: 'missing-delivery', category: 'tracking', question: 'My package says delivered, but I cannot find it. What should I do?',
    answer: 'Review the tracking details, check the delivery area, and ask others at the address. If you still need help, contact FedEx through its customer support page. A shipment cannot be investigated or a support case opened here.',
    keywords: 'missing lost stolen proof delivery package receiving',
    link: { label: 'Get delivery support', href: 'https://www.fedex.com/en-us/customer-support.html' },
  },
  {
    id: 'shipping-rates', category: 'shipping', question: 'How can I get a shipping quote?',
    answer: 'Our rate calculator provides estimates using your ZIP codes, weight, and optional dimensions. These are not carrier prices or guaranteed delivery dates. Open the FedEx calculator for current rates, fees, and service availability.',
    keywords: 'rates cost price calculate estimate weight dimensions',
    link: { label: 'Open the rate calculator', href: '/rate-calculator' },
  },
  {
    id: 'schedule-pickup', category: 'shipping', question: 'How do I schedule a pickup?',
    answer: 'Use our pickup planning tool to review a ZIP code, date, package count, and local time window. No pickup is booked in this project. Finish the actual reservation on the FedEx booking page, where availability and any fees are confirmed.',
    keywords: 'collection collect pickup pick up schedule booking driver',
    link: { label: 'Prepare a pickup plan', href: '/shipping/pickup' },
  },
  {
    id: 'packing-supplies', category: 'shipping', question: 'Are FedEx packaging supplies free?',
    answer: 'Complimentary FedEx packaging is available for qualifying express services with an eligible account. Other shipping boxes, packing materials, and FedEx Office products may have a cost. Check the FedEx supplies page for eligibility and ordering.',
    keywords: 'pack packing box boxes envelope supplies free tape',
    link: { label: 'Check packaging requirements', href: 'https://www.fedex.com/en-us/shipping/packing/supplies.html' },
  },
  {
    id: 'international-shipping', category: 'shipping', question: 'Where can I find help with international shipping?',
    answer: 'Visit the FedEx international shipping resources for destinations, customs forms, duties, and documentation. The rate calculator is limited to U.S. parcel estimates and does not calculate international duties or taxes.',
    keywords: 'international customs borders export import taxes duties country',
    link: { label: 'Explore international shipping', href: 'https://www.fedex.com/en-us/shipping/international.html' },
  },
  {
    id: 'print-files', category: 'printing', question: 'What files can I use for a print project?',
    answer: 'The local print planner accepts a non-empty PDF, JPG, or PNG up to 20 MB for filename and size reference only. It does not upload, preview, or check print quality. FedEx Office recommends PDF for many projects; actual accepted formats and production requirements vary by product.',
    keywords: 'print printing upload file pdf png jpg jpeg artwork design',
    link: { label: 'Prepare a print project', href: '/design-print' },
  },
  {
    id: 'place-print-order', category: 'printing', question: 'Does downloading a print brief place an order?',
    answer: 'No. A downloaded brief is just a text summary of your product, desired quantity, preferences, notes, and optional filename. No file is sent and no print order is placed. Continue to the relevant FedEx Office product page to upload your artwork and place a real order.',
    keywords: 'print order download brief checkout production business cards posters',
    link: { label: 'Browse FedEx Office printing', href: 'https://www.office.fedex.com/default/custom-printing-solutions' },
  },
  {
    id: 'return-package', category: 'returns', question: 'How do I return a package?',
    answer: 'For a real return, follow the retailer’s instructions and use its return label or QR code. Service and drop-off options can vary. Our local returns planner can organize reference notes and photo filenames into a downloadable brief; it does not issue a label, arrange a shipment, submit a request, or approve a refund.',
    keywords: 'return returns label retailer refund qr code brief preparation',
    link: { label: 'Prepare a local return brief', href: '/returns' },
  },
  {
    id: 'file-claim', category: 'returns', question: 'How do I file a claim for a lost or damaged shipment?',
    answer: 'Use the FedEx claims page for eligibility, required documents, deadlines, and case status. This project cannot submit claims, issue refunds, or connect you to a real representative.',
    keywords: 'claim claims damaged damage lost reimbursement compensation refund',
    link: { label: 'Go to FedEx claims', href: 'https://www.fedex.com/en-us/customer-support/claims.html' },
  },
  {
    id: 'sample-account', category: 'shipping', question: 'Is this site connected to my FedEx account?',
    answer: 'No. Shipping, tracking, store, and account tools here do not access a FedEx account or live carrier services. Do not enter account credentials or payment details. Use fedex.com for account services.',
    keywords: 'account login sign in password privacy personal data payment',
    link: { label: 'Visit fedex.com', href: 'https://www.fedex.com/en-us/home.html' },
  },
];

export function searchHelp(query: string, category: HelpCategory | 'all') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return helpArticles.filter((article) => {
    const searchable = `${article.question} ${article.answer} ${article.keywords}`.toLowerCase();
    return (category === 'all' || article.category === category) && words.every((word) => searchable.includes(word));
  });
}
