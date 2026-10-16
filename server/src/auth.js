import { betterAuth, APIError } from 'better-auth';
import { admin } from 'better-auth/plugins';

export function authOptions(pool, config, mailer) {
  const deliver = (to, subject, message, url) =>
    mailer.send({
      to,
      subject,
      text: `${message}\n\n${url}\n\nThis account belongs to an independent shipping-planning project, not FedEx. If you did not request this message, ignore it.`,
    });
  const validateUser = async (value) => {
    if (
      typeof value.name !== 'string' ||
      !value.name.trim() ||
      value.name.length > 60 ||
      typeof value.email !== 'string' ||
      value.email.length > 160
    )
      throw new APIError('BAD_REQUEST', {
        message: 'Use a display name (1–60 characters) and a valid workspace email.',
      });
    return { data: { ...value, name: value.name.trim(), email: value.email.trim().toLowerCase() } };
  };
  return {
    appName: 'Shipping workspace',
    baseURL: config.origin,
    basePath: '/api/auth',
    secret: config.secret,
    database: pool,
    trustedOrigins: [config.origin],
    telemetry: { enabled: false },
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 900,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        deliver(
          user.email,
          'Reset your workspace passphrase',
          'Reset your workspace passphrase using this single-use link. It expires in 15 minutes.',
          url,
        ),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) =>
        deliver(
          user.email,
          'Verify your workspace email',
          'Verify your email for this independent workspace. This link expires in one hour.',
          url,
        ),
    },
    user: {
      modelName: 'fedexr_auth_user',
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: false,
        sendChangeEmailConfirmation: async ({ user, url }) =>
          deliver(
            user.email,
            'Confirm a workspace email change',
            'Confirm the requested workspace email change. Your old email remains in use until the verification process is complete.',
            url,
          ),
      },
      deleteUser: { enabled: false },
    },
    session: {
      modelName: 'fedexr_auth_session',
      expiresIn: 7 * 86400,
      updateAge: 86400,
      freshAge: 3600,
      cookieCache: { enabled: false },
    },
    account: { modelName: 'fedexr_auth_account' },
    verification: { modelName: 'fedexr_auth_verification', storeIdentifier: 'hashed' },
    rateLimit: {
      modelName: 'fedexr_auth_rate_limit',
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 300, max: 5 },
        '/send-verification-email': { window: 300, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: 'fedexr',
      useSecureCookies: config.origin.startsWith('https:'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
    },
    databaseHooks: {
      user: {
        create: { before: validateUser },
        update: {
          before: async (value) => {
            if (
              value.name !== undefined &&
              (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 60)
            )
              throw new APIError('BAD_REQUEST', {
                message: 'Use a display name from 1 to 60 characters.',
              });
            return {
              data: value.name === undefined ? value : { ...value, name: value.name.trim() },
            };
          },
        },
      },
    },
    plugins: [
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
        bannedUserMessage: 'Workspace access is suspended. Contact the workspace owner.',
      }),
    ],
    // Only narrowly scoped workspace administration is exposed by this application.
    disabledPaths: [
      '/admin/create-user',
      '/admin/set-role',
      '/admin/update-user',
      '/admin/ban-user',
      '/admin/unban-user',
      '/admin/impersonate-user',
      '/admin/stop-impersonating',
      '/admin/remove-user',
      '/admin/list-users',
      '/admin/list-user-sessions',
      '/admin/revoke-user-session',
      '/admin/revoke-user-sessions',
      '/admin/set-user-password',
      '/admin/has-permission',
    ],
  };
}

export function createAuthentication(pool, config, mailer) {
  return betterAuth(authOptions(pool, config, mailer));
}
