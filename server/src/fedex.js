import { HttpError, assert, text } from './validation.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeFedExTrackingNumber(value) {
  const normalized = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  assert(
    /^[0-9]{9,34}$/.test(normalized),
    'Enter a numeric FedEx tracking number with 9–34 digits.',
  );
  return normalized;
}

function locationLabel(location) {
  if (!location || typeof location !== 'object') return '';
  return [location.city, location.stateOrProvinceCode, location.countryCode]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(', ');
}

function dateValue(entries, types) {
  if (!Array.isArray(entries)) return '';
  const match = entries.find((entry) =>
    types.includes(entry?.dateTimeType || entry?.type || entry?.code),
  );
  return typeof match?.dateTime === 'string' ? match.dateTime : '';
}

function errorMessage(payload, fallback) {
  const error = Array.isArray(payload?.errors) ? payload.errors[0] : null;
  const code = typeof error?.code === 'string' ? error.code : '';
  return code ? `${fallback} FedEx error code: ${code}.` : fallback;
}

function requiredText(body, key, label, max = 100) {
  return text(body?.[key], label, max);
}

function partyInput(body, label) {
  assert(body && typeof body === 'object' && !Array.isArray(body), `Enter the ${label} details.`);
  const streetLines = Array.isArray(body.streetLines)
    ? body.streetLines.map((line, index) => text(line, `${label} street line ${index + 1}`, 100))
    : [text(body.street, `${label} street address`, 100)];
  assert(streetLines.length >= 1 && streetLines.length <= 3, `${label} needs 1–3 street lines.`);
  const countryCode = text(body.countryCode || 'US', `${label} country code`, 2).toUpperCase();
  assert(countryCode === 'US', 'The first Ship API workflow supports U.S. addresses only.');
  const stateOrProvinceCode = text(
    body.stateOrProvinceCode || body.state || body.region,
    `${label} state`,
    2,
  ).toUpperCase();
  assert(/^[A-Z]{2}$/.test(stateOrProvinceCode), `Enter a two-letter ${label} state code.`);
  const postalCode = text(body.postalCode, `${label} ZIP code`, 10);
  assert(/^\d{5}(?:-\d{4})?$/.test(postalCode), `Enter a valid ${label} ZIP code.`);
  return {
    contact: {
      personName: requiredText(body, 'name', `${label} name`),
      phoneNumber: text(body.phone || body.phoneNumber, `${label} phone number`, 25),
      ...(body.company || body.companyName
        ? { companyName: text(body.company || body.companyName, `${label} company`, 100) }
        : {}),
    },
    address: {
      streetLines,
      city: requiredText(body, 'city', `${label} city`),
      stateOrProvinceCode,
      postalCode,
      countryCode,
      residential: Boolean(body.residential),
    },
  };
}

export function shipmentInput(body, accountNumber) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 'Send a shipment object.');
  const serviceType = text(body.serviceType || 'FEDEX_GROUND', 'FedEx service type', 50).toUpperCase();
  const packagingType = text(
    body.packagingType || 'YOUR_PACKAGING',
    'FedEx packaging type',
    50,
  ).toUpperCase();
  const pickupType = text(
    body.pickupType || 'DROPOFF_AT_FEDEX_LOCATION',
    'FedEx pickup type',
    50,
  ).toUpperCase();
  for (const [label, value] of [
    ['service type', serviceType],
    ['packaging type', packagingType],
    ['pickup type', pickupType],
  ])
    assert(/^[A-Z][A-Z0-9_]{2,49}$/.test(value), `Choose a valid FedEx ${label}.`);
  const weight = Number(body.weightLb ?? body.weight);
  assert(Number.isFinite(weight) && weight >= 0.1 && weight <= 150, 'Package weight must be 0.1–150 lb.');
  const shipDate = text(body.shipDate || new Date().toISOString().slice(0, 10), 'Ship date', 10);
  const parsedDate = new Date(`${shipDate}T00:00:00Z`);
  assert(
    DATE_PATTERN.test(shipDate) &&
      Number.isFinite(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === shipDate &&
      parsedDate.getTime() >= Date.now() - 2 * 86400000,
    'Choose a valid ship date that is not in the past.',
  );
  const labelImageType = text(body.labelImageType || 'PDF', 'Label image type', 10).toUpperCase();
  assert(['PDF', 'PNG', 'ZPLII'].includes(labelImageType), 'Choose a PDF, PNG, or ZPLII label.');
  const shipper = partyInput(body.shipper, 'shipper');
  const recipient = partyInput(body.recipient, 'recipient');
  return {
    labelResponseOptions: 'URL_ONLY',
    accountNumber: { value: accountNumber },
    requestedShipment: {
      shipDatestamp: shipDate,
      pickupType,
      serviceType,
      packagingType,
      shipper,
      recipients: [recipient],
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: { responsibleParty: { accountNumber: { value: accountNumber } } },
      },
      labelSpecification: { labelStockType: 'PAPER_4X6', imageType: labelImageType },
      requestedPackageLineItems: [{ weight: { units: 'LB', value: weight } }],
    },
  };
}

function normalizeTrackResult(payload, requestedNumber) {
  const complete = Array.isArray(payload?.output?.completeTrackResults)
    ? payload.output.completeTrackResults[0]
    : null;
  const result = Array.isArray(complete?.trackResults) ? complete.trackResults[0] : null;
  const trackingNumber = complete?.trackingNumber || requestedNumber;
  if (!result || result.error || !result.latestStatusDetail) {
    return {
      found: false,
      trackingNumber,
      status: '',
      statusCode: '',
      service: '',
      latestLocation: '',
      estimatedDelivery: '',
      actualDelivery: '',
      events: [],
      message: 'FedEx has no tracking record for this number.',
    };
  }
  const latest = result.latestStatusDetail || {};
  const events = (Array.isArray(result.scanEvents) ? result.scanEvents : [])
    .slice(0, 30)
    .map((event) => ({
      at: typeof event?.date === 'string' ? event.date : '',
      description:
        event?.eventDescription || event?.derivedStatus || event?.eventStatusDescription || '',
      detail: event?.exceptionDescription || event?.statusExceptionDescription || '',
      location: locationLabel(event?.scanLocation),
    }))
    .filter((event) => event.at || event.description || event.location);
  const estimatedWindow = result.estimatedDeliveryTimeWindow?.window || {};
  return {
    found: true,
    trackingNumber,
    status: latest.description || latest.statusByLocale || latest.derivedCode || '',
    statusCode: latest.code || latest.statusType || latest.derivedCode || '',
    service: result.serviceDetail?.description || result.serviceDetail?.type || '',
    latestLocation: locationLabel(latest.scanLocation),
    estimatedDelivery:
      dateValue(result.dateAndTimes, ['ESTIMATED_DELIVERY', 'ESTIMATED_DELIVERY_DATE']) ||
      (typeof estimatedWindow.begins === 'string' ? estimatedWindow.begins : ''),
    estimatedDeliveryWindowEnd:
      typeof estimatedWindow.ends === 'string' ? estimatedWindow.ends : '',
    actualDelivery: dateValue(result.dateAndTimes, ['ACTUAL_DELIVERY', 'ACTUAL_DELIVERY_DATE']),
    shipDate: dateValue(result.dateAndTimes, ['SHIP', 'ACTUAL_PICKUP', 'PICKUP']),
    events,
  };
}

function normalizeShipmentResult(payload) {
  const shipment = Array.isArray(payload?.output?.transactionShipments)
    ? payload.output.transactionShipments[0]
    : null;
  const piece = Array.isArray(shipment?.pieceResponses) ? shipment.pieceResponses[0] : null;
  const documents = Array.isArray(piece?.packageDocuments) ? piece.packageDocuments : [];
  const labelDocument =
    documents.find((document) => document?.url || document?.encodedLabel) || documents[0] || {};
  return {
    trackingNumber: shipment?.masterTrackingNumber || piece?.trackingNumber || '',
    serviceType: shipment?.serviceType || piece?.serviceType || '',
    jobId: payload?.output?.jobId || shipment?.jobId || '',
    label: {
      format: labelDocument.imageType || labelDocument.contentType || '',
      url: labelDocument.url || '',
      encodedLabel: labelDocument.encodedLabel || '',
    },
  };
}

export function createFedExClient({ config, fetchImpl = fetch, now = Date.now } = {}) {
  let tokenCache = { value: '', expiresAt: 0 };

  async function fetchJson(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { response, payload };
    } catch (cause) {
      if (cause?.name === 'AbortError')
        throw new HttpError(503, 'FedEx API did not respond in time. Try again.');
      throw new HttpError(503, 'FedEx API could not be reached from this server.');
    } finally {
      clearTimeout(timer);
    }
  }

  async function accessToken(force = false) {
    if (!config?.fedexConfigured)
      throw new HttpError(503, 'FedEx API is not configured on this server.');
    if (!force && tokenCache.value && tokenCache.expiresAt > now() + 30000) return tokenCache.value;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.fedexClientId,
      client_secret: config.fedexClientSecret,
    });
    const { response, payload } = await fetchJson(`${config.fedexBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok || !payload?.access_token) {
      if (response.status === 401 || response.status === 403)
        throw new HttpError(503, 'FedEx rejected the server API credentials.');
      throw new HttpError(503, errorMessage(payload, 'FedEx authentication failed.'));
    }
    const expiresIn = Number(payload.expires_in || 3600);
    tokenCache = {
      value: payload.access_token,
      expiresAt: now() + Math.max(60, expiresIn - 60) * 1000,
    };
    return tokenCache.value;
  }

  async function call(path, body, retry = true) {
    const token = await accessToken();
    const { response, payload } = await fetchJson(`${config.fedexBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-locale': 'en_US',
      },
      body: JSON.stringify(body),
    });
    if (response.status === 401 && retry) {
      tokenCache = { value: '', expiresAt: 0 };
      return call(path, body, false);
    }
    return { response, payload };
  }

  return {
    status() {
      return {
        provider: 'FedEx',
        configured: Boolean(config?.fedexConfigured),
        environment: config?.fedexEnvironment || 'sandbox',
        trackingEnabled: Boolean(config?.fedexConfigured),
        accountConfigured: Boolean(config?.fedexAccountConfigured),
        shipmentCreationEnabled: Boolean(config?.fedexShipmentCreationEnabled),
        missing: Array.isArray(config?.fedexMissing) ? config.fedexMissing : [],
      };
    },
    async track(value) {
      const trackingNumber = normalizeFedExTrackingNumber(value);
      const { response, payload } = await call('/track/v1/trackingnumbers', {
        includeDetailedScans: true,
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
      });
      if (response.status === 404) return normalizeTrackResult(null, trackingNumber);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new HttpError(503, 'FedEx rejected the server API credentials.');
        throw new HttpError(503, errorMessage(payload, 'FedEx tracking lookup failed.'));
      }
      return normalizeTrackResult(payload, trackingNumber);
    },
    async createShipment(body) {
      if (!config?.fedexShipmentCreationEnabled)
        throw new HttpError(
          503,
          'Official FedEx shipment creation is disabled until the server has a FedEx account number and FEDEX_CREATE_SHIPMENTS_ENABLED=true.',
        );
      const shipment = shipmentInput(body, config.fedexAccountNumber);
      const { response, payload } = await call('/ship/v1/shipments', shipment);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new HttpError(503, 'FedEx rejected the server API credentials or account.');
        throw new HttpError(503, errorMessage(payload, 'FedEx shipment creation failed.'));
      }
      const result = normalizeShipmentResult(payload);
      if (!result.trackingNumber)
        throw new HttpError(503, 'FedEx accepted the request but did not return a tracking number.');
      return result;
    },
  };
}
