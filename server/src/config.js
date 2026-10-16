const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

export function configuration(env = process.env) {
  const missing = [];
  const databaseURL = env.NEON_DATABASE_URL || env.DATABASE_URL || '';
  const secret = env.AUTH_SECRET || '';
  const imageAdminSecret = env.ADMIN_SECRET || '';
  const allowLegacyImageKey = env.ALLOW_LEGACY_IMAGE_KEY === 'true';
  const imageKeyValid =
    /^[\x21-\x7e]{32,256}$/.test(imageAdminSecret) &&
    !/replace|example|changeme/i.test(imageAdminSecret) &&
    imageAdminSecret !== secret;
  const fedexEnvironmentInput = String(env.FEDEX_ENV || 'sandbox').trim().toLowerCase();
  const fedexEnvironment = ['sandbox', 'production'].includes(fedexEnvironmentInput)
    ? fedexEnvironmentInput
    : 'sandbox';
  const fedexClientId = String(env.FEDEX_CLIENT_ID || '').trim();
  const fedexClientSecret = String(env.FEDEX_CLIENT_SECRET || '').trim();
  const fedexAccountNumber = String(env.FEDEX_ACCOUNT_NUMBER || '').replace(/[\s-]/g, '');
  let fedexBaseUrl =
    fedexEnvironment === 'production' ? 'https://apis.fedex.com' : 'https://apis-sandbox.fedex.com';
  let fedexBaseUrlValid = true;
  if (env.FEDEX_API_BASE_URL) {
    try {
      const url = new URL(env.FEDEX_API_BASE_URL);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.protocol !== 'https:' &&
          !(env.NODE_ENV !== 'production' && url.protocol === 'http:' && loopback.has(url.hostname)))
      )
        throw new Error();
      fedexBaseUrl = url.origin + url.pathname.replace(/\/+$/, '');
    } catch {
      fedexBaseUrlValid = false;
    }
  }
  const fedexMissing = [];
  if (!fedexClientId) fedexMissing.push('FEDEX_CLIENT_ID');
  if (!fedexClientSecret) fedexMissing.push('FEDEX_CLIENT_SECRET');
  if (!['sandbox', 'production'].includes(fedexEnvironmentInput))
    fedexMissing.push('FEDEX_ENV (sandbox or production)');
  if (!fedexBaseUrlValid) fedexMissing.push('FEDEX_API_BASE_URL (valid FedEx API base URL)');
  const fedexConfigured = fedexMissing.length === 0;
  const fedexAccountConfigured = /^[A-Za-z0-9]{6,20}$/.test(fedexAccountNumber);
  if (!fedexAccountConfigured) fedexMissing.push('FEDEX_ACCOUNT_NUMBER');
  const fedexShipmentCreationEnabled =
    fedexConfigured && fedexAccountConfigured && env.FEDEX_CREATE_SHIPMENTS_ENABLED === 'true';
  let databaseConfigured = false;
  let origin = '';
  try {
    const url = new URL(env.APP_ORIGIN || '');
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    )
      throw new Error();
    if (
      url.protocol !== 'https:' &&
      !(env.NODE_ENV !== 'production' && url.protocol === 'http:' && loopback.has(url.hostname))
    )
      throw new Error();
    origin = url.origin;
  } catch {
    missing.push('APP_ORIGIN (HTTPS; loopback HTTP is development-only)');
  }
  try {
    const url = new URL(databaseURL);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      ['HOST', 'host'].includes(url.hostname)
    )
      throw new Error();
    databaseConfigured = true;
  } catch {
    missing.push('DATABASE_URL or NEON_DATABASE_URL');
  }
  if (secret.length < 32 || /replace|example|changeme/i.test(secret))
    missing.push('AUTH_SECRET (at least 32 random characters)');
  if (!env.SMTP_URL || !/^smtps?:\/\//i.test(env.SMTP_URL)) missing.push('SMTP_URL');
  if (!env.MAIL_FROM || /[\r\n]/.test(env.MAIL_FROM)) missing.push('MAIL_FROM');
  return {
    databaseURL,
    databaseConfigured,
    imageAdminSecret,
    allowLegacyImageKey,
    imageKeyValid,
    secret,
    origin,
    smtpURL: env.SMTP_URL || '',
    mailFrom: env.MAIL_FROM || '',
    port: Number(env.ACCOUNTS_PORT || 3001),
    production: env.NODE_ENV === 'production',
    missing,
    ready: missing.length === 0,
    fedexClientId,
    fedexClientSecret,
    fedexAccountNumber,
    fedexEnvironment,
    fedexBaseUrl,
    fedexConfigured,
    fedexAccountConfigured,
    fedexShipmentCreationEnabled,
    fedexMissing,
  };
}

export function safeConfiguration(config) {
  const carrier = {
    provider: 'FedEx',
    configured: Boolean(config.fedexConfigured),
    environment: config.fedexEnvironment || 'sandbox',
    trackingEnabled: Boolean(config.fedexConfigured),
    accountConfigured: Boolean(config.fedexAccountConfigured),
    shipmentCreationEnabled: Boolean(config.fedexShipmentCreationEnabled),
    missing: Array.isArray(config.fedexMissing) ? config.fedexMissing : [],
  };
  return {
    mode: 'server',
    configured: config.ready,
    missing: config.missing,
    carrier,
    carrierConnected: carrier.trackingEnabled,
  };
}
