export type ReturnMode = 'return' | 'claim';
export type ReturnLabel = 'printed' | 'qr' | 'none';
export const officialReturnGuide = 'https://www.fedex.com/en-us/shipping/returns.html';
export const officialClaimCenter = 'https://www.fedex.com/eclaims/#/claimcenter?locale=en_US';

export const returnLabelOptions = [
  { id: 'printed', label: 'I have a return label', description: 'Follow the retailer’s packing and drop-off instructions.' },
  { id: 'qr', label: 'I have a retailer QR code', description: 'Check the retailer’s email for participating locations and packaging instructions.' },
  { id: 'none', label: 'I need a return label', description: 'Contact the retailer first to check its return policy and label options.' },
] as const;

export const returnReasons = [
  { id: 'unwanted', label: 'Item no longer needed' },
  { id: 'wrong', label: 'Wrong item received' },
  { id: 'damaged', label: 'Item arrived damaged' },
  { id: 'other', label: 'Another return reason' },
] as const;

export const claimReasons = [
  { id: 'damaged', label: 'Damaged package or contents' },
  { id: 'lost', label: 'Lost shipment' },
  { id: 'missing', label: 'Missing contents' },
  { id: 'other', label: 'Another shipping issue' },
] as const;

export const packageConditions = [
  { id: 'unopened', label: 'Unopened' },
  { id: 'opened', label: 'Opened, unused' },
  { id: 'used', label: 'Used' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'unavailable', label: 'Package unavailable' },
] as const;

export interface ReturnPlan {
  mode: ReturnMode;
  reference: string;
  label: ReturnLabel | '';
  reason: string;
  condition: string;
  notes: string;
}
export interface LocalPhoto { id: string; file: File }

export function validReference(value: string): boolean {
  return value.trim() === '' || /^[a-zA-Z0-9 -]{4,40}$/.test(value.trim());
}

export function returnPlanErrors(plan: ReturnPlan, step: 1 | 2): string[] {
  const errors: string[] = [];
  if (step === 1) {
    if (!validReference(plan.reference)) errors.push('Use 4–40 letters, numbers, spaces, or hyphens for a reference, or leave it blank.');
    if (plan.mode === 'return' && !returnLabelOptions.some((option) => option.id === plan.label)) errors.push('Choose whether you have a label, a retailer QR code, or need a label.');
  } else {
    const reasons = plan.mode === 'claim' ? claimReasons : returnReasons;
    if (!reasons.some((reason) => reason.id === plan.reason)) errors.push('Choose a reason for your plan.');
    if (!packageConditions.some((condition) => condition.id === plan.condition)) errors.push('Choose the package condition, including “Package unavailable” when applicable.');
  }
  return errors;
}

export function photoFileError(file: File): string {
  if (!/\.(png|jpe?g)$/i.test(file.name) || (file.type && !['image/png', 'image/jpeg'].includes(file.type)) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    return 'Choose non-empty JPG or PNG photos up to 10 MB each. Invalid files were not added.';
  }
  return '';
}

export function nextSteps(plan: ReturnPlan): string[] {
  if (plan.mode === 'claim') return [
    'Check the FedEx claims website for eligibility, deadlines, and required documents. Sign in there to submit a real claim.',
    'Gather the tracking details, proof of value or purchase receipt, and relevant photos when available.',
    'For damage or missing contents, retain the original packaging and contents until the claim is resolved.',
    'Nothing in this local brief confirms claim eligibility, approves a refund, or establishes a resolution date.',
  ];
  const labelStep = plan.label === 'printed'
    ? 'Follow the retailer’s return instructions, pack the item, and attach its valid return label.'
    : plan.label === 'qr'
      ? 'Use the retailer’s QR code at a participating location listed in its instructions. Do not assume every location accepts every return program.'
      : 'Contact the retailer to check its return policy and request a label. If needed, review the FedEx label-creation options.';
  return [
    labelStep,
    'Check packaging requirements and whether the return program includes any shipping fees before sending the item.',
    'Keep the drop-off receipt and use the actual return tracking number to follow the shipment on fedex.com.',
    'The retailer, not this project, determines its refund or replacement policy. No return, label, or refund is created here.',
  ];
}

export function returnBriefText(plan: ReturnPlan, photos: LocalPhoto[]): string {
  const reasons = plan.mode === 'claim' ? claimReasons : returnReasons;
  return [
    `${plan.mode === 'claim' ? 'CLAIM' : 'RETURN'} PREPARATION BRIEF`,
    'NOTHING has been submitted to FedEx or a retailer.',
    'This is not a shipping label, case confirmation, refund approval, or formal document.',
    'No shipment lookup has been performed. Use FedEx tools to verify an actual shipment.',
    '',
    `Reference: ${plan.reference.trim() || 'Not provided (no shipment lookup performed)'}`,
    `Plan type: ${plan.mode === 'claim' ? 'Shipping claim preparation' : 'Retailer return preparation'}`,
    ...(plan.mode === 'return' ? [`Label situation: ${returnLabelOptions.find((option) => option.id === plan.label)?.label || 'Not specified'}`] : []),
    `Reason: ${reasons.find((reason) => reason.id === plan.reason)?.label || 'Not specified'}`,
    `Condition: ${packageConditions.find((condition) => condition.id === plan.condition)?.label || 'Not specified'}`,
    `Notes: ${plan.notes.trim() || 'None'}`,
    '',
    'Local photo references (file contents are NOT included or uploaded):',
    ...(photos.length ? photos.map((photo) => `- ${photo.file.name} (${photo.file.size} bytes)`) : ['None selected']),
    '',
    'NEXT STEPS',
    ...nextSteps(plan).map((step, index) => `${index + 1}. ${step}`),
    '',
    `Resource: ${plan.mode === 'claim' ? officialClaimCenter : officialReturnGuide}`,
    'Enter details and attach any required files on the FedEx site; this brief is not transferred automatically.',
  ].join('\n');
}
