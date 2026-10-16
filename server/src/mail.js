import nodemailer from 'nodemailer';

export function smtpOptions(value) {
  const url = new URL(value);
  if (!['smtp:', 'smtps:'].includes(url.protocol) || !url.hostname)
    throw new Error('SMTP configuration is invalid.');
  const secure = url.protocol === 'smtps:';
  return {
    host: url.hostname,
    port: Number(url.port || (secure ? 465 : 587)),
    secure,
    requireTLS: !secure,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    auth: url.username
      ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  };
}
export function smtpMailer(config) {
  let transport;
  return {
    async send({ to, subject, text }) {
      if (!config.smtpURL || !config.mailFrom)
        throw new Error('Account email delivery is not configured.');
      transport ||= nodemailer.createTransport(smtpOptions(config.smtpURL));
      try {
        const result = await transport.sendMail({ from: config.mailFrom, to, subject, text });
        if (!result.accepted?.length) throw new Error('Email was not accepted.');
      } catch {
        // Operational signal only: never log recipients, verification URLs, or SMTP credentials.
        console.error('account_mail_delivery_failed');
        throw new Error('Account email delivery is temporarily unavailable.');
      }
    },
    close() {
      transport?.close();
    },
  };
}
