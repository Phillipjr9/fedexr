import { accountRequest } from '@/lib/accountApi';

export interface CarrierStatus {
  provider: 'FedEx';
  configured: boolean;
  environment: 'sandbox' | 'production';
  trackingEnabled: boolean;
  accountConfigured: boolean;
  shipmentCreationEnabled: boolean;
  missing: string[];
}

export interface CarrierPartyInput {
  name: string;
  phone: string;
  company?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: 'US';
  residential: boolean;
}

export interface CarrierShipmentInput {
  serviceType: string;
  packagingType: string;
  pickupType: string;
  shipDate: string;
  weightLb: number;
  labelImageType: 'PDF' | 'PNG' | 'ZPLII';
  shipper: CarrierPartyInput;
  recipient: CarrierPartyInput;
}

export interface CarrierShipmentResult {
  trackingNumber: string;
  serviceType: string;
  jobId: string;
  label: {
    format: string;
    url: string;
    encodedLabel: string;
  };
}

export const unavailableCarrierStatus: CarrierStatus = {
  provider: 'FedEx',
  configured: false,
  environment: 'sandbox',
  trackingEnabled: false,
  accountConfigured: false,
  shipmentCreationEnabled: false,
  missing: ['Carrier status service'],
};

export async function getCarrierStatus(signal?: AbortSignal): Promise<CarrierStatus> {
  try {
    const result = await accountRequest<{ carrier: CarrierStatus }>(
      '/api/carrier/status',
      'GET',
      undefined,
      signal,
    );
    return result.carrier;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    return unavailableCarrierStatus;
  }
}

export async function createCarrierShipment(
  input: CarrierShipmentInput,
): Promise<CarrierShipmentResult> {
  const result = await accountRequest<{ carrierShipment: CarrierShipmentResult }>(
    '/api/carrier/shipments',
    'POST',
    input,
  );
  return result.carrierShipment;
}
