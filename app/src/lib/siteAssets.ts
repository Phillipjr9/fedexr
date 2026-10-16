export interface SiteImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

// Genuine FedEx photography, served locally. See public/images/fedex/SOURCES.md.
export const siteImages = {
  logo: {
    src: '/images/fedex/logo.png',
    alt: 'FedEx',
    width: 95,
    height: 35,
  },
  automotive: {
    src: '/images/fedex/automotive-parts.jpg',
    alt: 'Automotive parts including a brake rotor, turbocharger, pistons, and spark plugs',
    width: 933,
    height: 345,
  },
  professional: {
    src: '/images/fedex/delivery-professional.jpg',
    alt: 'A FedEx courier carrying a package beside a delivery truck',
    width: 727,
    height: 463,
  },
  mobile: {
    src: '/images/fedex/mobile-app.jpg',
    alt: 'A customer checking their phone while holding a FedEx envelope',
    width: 694,
    height: 463,
  },
  deliveryManager: {
    src: '/images/fedex/delivery-manager.jpg',
    alt: 'A FedEx courier delivering a package to a customer at home',
    width: 695,
    height: 463,
  },
  pictureProof: {
    src: '/images/fedex/picture-proof.jpg',
    alt: 'A customer viewing a FedEx picture proof of delivery on their phone',
    width: 1000,
    height: 563,
  },
  international: {
    src: '/images/fedex/international-shipping.jpg',
    alt: 'A FedEx team member carrying a package beside an aircraft engine',
    width: 727,
    height: 463,
  },
  globalTrade: {
    src: '/images/fedex/global-trade.jpg',
    alt: 'A small-business owner preparing a FedEx shipment in a workshop',
    width: 727,
    height: 463,
  },
  ground: {
    src: '/images/fedex/ground-shipping.jpg',
    alt: 'FedEx team members preparing packages in a shipping facility',
    width: 727,
    height: 463,
  },
  rewards: {
    src: '/images/fedex/rewards.jpg',
    alt: 'A business owner working on a laptop beside FedEx shipping boxes',
    width: 694,
    height: 463,
  },
  packaging: {
    src: '/images/fedex/reusable-packaging.jpg',
    alt: 'A FedEx Reusable Padded Pak with purple and orange branding',
    width: 727,
    height: 463,
  },
  officePrinting: {
    src: '/images/fedex/office-printing.jpg',
    alt: 'A FedEx Office team member helping a customer with a printed business sign',
    width: 842,
    height: 565,
  },
  officeConsultation: {
    src: '/images/fedex/office-consultation.jpg',
    alt: 'Printed marketing materials being reviewed at a FedEx Office counter',
    width: 727,
    height: 463,
  },
  officeLocation: {
    src: '/images/fedex/office-location.jpg',
    alt: 'A FedEx Office team member discussing packing an artwork with a customer',
    width: 727,
    height: 463,
  },
  officePacking: {
    src: '/images/fedex/office-packing.jpg',
    alt: 'A FedEx Office team member wrapping an item beside shipping boxes',
    width: 727,
    height: 463,
  },
  printBusinessCards: {
    src: '/images/fedex/print-business-cards.jpg',
    alt: 'Printed business cards with a floral design photographed with purple stationery',
    width: 400,
    height: 200,
  },
  printPosters: {
    src: '/images/fedex/print-posters.jpg',
    alt: 'Colorful mounted print sheets showing poster finishing options',
    width: 410,
    height: 272,
  },
  printMarketing: {
    src: '/images/fedex/print-marketing.jpg',
    alt: 'Printed brochures and business cards for an eye care business',
    width: 600,
    height: 600,
  },
  printInvitations: {
    src: '/images/fedex/print-invitations.jpg',
    alt: 'A collection of printed invitations, greeting cards, and stationery',
    width: 842,
    height: 565,
  },
  customSelfSealingBox: {
    src: '/images/fedex/custom-self-sealing-box.jpg',
    alt: 'An open Snap2Pack custom self-sealing box with a blue printed interior and adhesive strips',
    width: 600,
    height: 600,
  },
  customPaddedMailers: {
    src: '/images/fedex/custom-padded-mailers.jpg',
    alt: 'A group of kraft paper padded mailers, including a custom-printed mailer',
    width: 600,
    height: 600,
  },
  customRigidMailers: {
    src: '/images/fedex/custom-rigid-mailers.jpg',
    alt: 'Two custom-printed kraft rigid mailers photographed on a wooden surface',
    width: 600,
    height: 600,
  },
  returnsKiosk: {
    src: '/images/fedex/returns-kiosk.jpg',
    alt: 'A customer carrying a package while using a FedEx Office self-service shipping kiosk',
    width: 842,
    height: 565,
  },
} satisfies Record<string, SiteImage>;
