const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

export function configuration(env = process.env) {
  const missing = [];
  const databaseURL = env.NEON_DATABASE_URL || env.DATABASE_URL || '';
  // JWT_SECRET is accepted as the signing secret so an existing hosting secret
  // keeps working; AUTH_SECRET still wins when both are present.
  const secret = env.AUTH_SECRET || env.JWT_SECRET || '';
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
  // APP_ORIGIN wins. On Vercel the platform-provided production URL is accepted
  // as a fallback so the origin cannot drift from the actual deployment host.
  const originCandidates = [
    env.APP_ORIGIN || '',
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '',
  ];
  for (const candidate of originCandidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.pathname !== '/' && url.pathname !== '')
      )
        continue;
      if (
        url.protocol !== 'https:' &&
        !(env.NODE_ENV !== 'production' && url.protocol === 'http:' && loopback.has(url.hostname))
      )
        continue;
      origin = url.origin;
      break;
    } catch {
      /* try the next candidate */
    }
  }
  if (!origin) missing.push('APP_ORIGIN (HTTPS; loopback HTTP is development-only)');
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
    missing.push('AUTH_SECRET or JWT_SECRET (at least 32 random characters)');
  // Resend publishes an SMTP endpoint, so an existing RESEND_API_KEY is enough
  // to deliver verification and reset mail without a hand-written SMTP_URL.
  const resendKey = String(env.RESEND_API_KEY || '').trim();
  const smtpURL =
    env.SMTP_URL || (resendKey ? `smtps://resend:${encodeURIComponent(resendKey)}@smtp.resend.com` : '');
  const mailFrom = env.MAIL_FROM || env.RESEND_FROM_EMAIL || '';
  if (!smtpURL || !/^smtps?:\/\//i.test(smtpURL)) missing.push('SMTP_URL (or RESEND_API_KEY)');
  if (!mailFrom || /[\r\n]/.test(mailFrom)) missing.push('MAIL_FROM (or RESEND_FROM_EMAIL)');
  // Optional bootstrap administrator: the account named by ADMIN_EMAIL is kept
  // verified and in the admin role, signing in with ADMIN_PASSWORD.
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(env.ADMIN_PASSWORD || '');
  const adminBootstrapMissing = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminEmail.length > 160)
    adminBootstrapMissing.push('ADMIN_EMAIL (valid address)');
  // better-auth enforces a 10–128 character password, so a shorter configured
  // value can never be used to sign in and is reported instead of silently failing.
  if (adminPassword.length < 10 || adminPassword.length > 128)
    adminBootstrapMissing.push('ADMIN_PASSWORD (10–128 characters)');
  const adminBootstrapConfigured = adminBootstrapMissing.length === 0;
  return {
    databaseURL,
    databaseConfigured,
    imageAdminSecret,
    allowLegacyImageKey,
    imageKeyValid,
    secret,
    origin,
    smtpURL,
    mailFrom,
    adminEmail,
    adminPassword,
    adminBootstrapConfigured,
    adminBootstrapMissing,
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
