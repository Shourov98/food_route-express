import dotenv from 'dotenv';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadGeographyConfig } from './modules/geography/geographyPolicy.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

function parseJsonConfig(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseList(value, fallback = ['*']) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const items = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

function getNestedValue(source, path) {
  return path.reduce((current, key) => {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return undefined;
    }
    return current[key];
  }, source);
}

function resolveConfigValue({ envKey, runtimeConfig, runtimePath, fallback }) {
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== null && envValue !== '') {
    return envValue;
  }

  const runtimeValue = getNestedValue(runtimeConfig, runtimePath);
  if (runtimeValue !== undefined && runtimeValue !== null && runtimeValue !== '') {
    return runtimeValue;
  }

  return fallback;
}

export function loadConfig() {
  const firebaseRuntimeConfig = parseJsonConfig(process.env.FIREBASE_CONFIG);
  const cloudRuntimeConfig = parseJsonConfig(process.env.CLOUD_RUNTIME_CONFIG);

  return {
    port: Number(process.env.PORT ?? 5050),
    apiV1Prefix: process.env.API_V1_PREFIX ?? '/api/v1',
    corsAllowOrigins: parseList(process.env.CORS_ALLOW_ORIGINS, ['*']),
    corsAllowCredentials: parseBoolean(process.env.CORS_ALLOW_CREDENTIALS, false),
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '50mb',
    swaggerTitle: process.env.SWAGGER_TITLE ?? 'Food Route Express API',
    swaggerDescription:
      process.env.SWAGGER_DESCRIPTION ??
      'Food Route backend API.\n\nSwagger authentication:\n- Click `Authorize` in the top-right corner.\n- Paste the raw bearer token only, without the `Bearer ` prefix.\n- Swagger will attach the token to protected requests automatically.',
    firebaseProjectId:
      process.env.APP_FIREBASE_PROJECT_ID ?? firebaseRuntimeConfig.projectId ?? 'demo-food-route',
    firebaseUseEmulators: parseBoolean(process.env.APP_FIREBASE_USE_EMULATORS, true),
    firebaseAuthEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
    firebaseWebApiKey: process.env.APP_FIREBASE_WEB_API_KEY ?? 'demo-api-key',
    firebaseStorageBucket:
      process.env.APP_FIREBASE_STORAGE_BUCKET ?? firebaseRuntimeConfig.storageBucket ?? '',
    imageUploadMaxBytes: Number(process.env.IMAGE_UPLOAD_MAX_BYTES ?? 5242880),
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '',
    firebaseServiceAccountJson: process.env.APP_FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
    authVerificationMode: process.env.AUTH_VERIFICATION_MODE ?? 'otp',
    authPasswordResetMode: process.env.AUTH_PASSWORD_RESET_MODE ?? 'otp',
    otpSigningSecret: process.env.OTP_SIGNING_SECRET ?? 'change-me',
    otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 10),
    otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60),
    otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    emailDeliveryMode: process.env.EMAIL_DELIVERY_MODE ?? 'log',
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUsername: process.env.SMTP_USERNAME ?? '',
    smtpPassword: process.env.SMTP_PASSWORD ?? '',
    smtpUseStartTls: parseBoolean(process.env.SMTP_USE_STARTTLS, true),
    smtpUseSsl: parseBoolean(process.env.SMTP_USE_SSL, false),
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? '',
    emailReplyTo: process.env.EMAIL_REPLY_TO ?? '',
    adminDashboardLoginUrl: process.env.ADMIN_DASHBOARD_LOGIN_URL ?? '',
    pushNotificationProvider: resolveConfigValue({
      envKey: 'PUSH_NOTIFICATION_PROVIDER',
      runtimeConfig: cloudRuntimeConfig,
      runtimePath: ['push', 'provider'],
      fallback: 'firebase',
    }),
    onesignalAppId: resolveConfigValue({
      envKey: 'ONESIGNAL_APP_ID',
      runtimeConfig: cloudRuntimeConfig,
      runtimePath: ['onesignal', 'app_id'],
      fallback: '',
    }),
    onesignalRestApiKey: resolveConfigValue({
      envKey: 'ONESIGNAL_REST_API_KEY',
      runtimeConfig: cloudRuntimeConfig,
      runtimePath: ['onesignal', 'rest_api_key'],
      fallback: '',
    }),
    onesignalApiUrl: resolveConfigValue({
      envKey: 'ONESIGNAL_API_URL',
      runtimeConfig: cloudRuntimeConfig,
      runtimePath: ['onesignal', 'api_url'],
      fallback: 'https://api.onesignal.com/notifications',
    }),
    proximityAlertCooldownMinutes: Number(process.env.PROXIMITY_ALERT_COOLDOWN_MINUTES ?? 1440),
    internalJobsSecret: process.env.INTERNAL_JOBS_SECRET ?? '',
    initialSuperAdminFullname: process.env.INITIAL_SUPER_ADMIN_FULLNAME ?? '',
    initialSuperAdminPhone: process.env.INITIAL_SUPER_ADMIN_PHONE ?? '',
    initialSuperAdminEmail: process.env.INITIAL_SUPER_ADMIN_EMAIL ?? '',
    initialSuperAdminPassword: process.env.INITIAL_SUPER_ADMIN_PASSWORD ?? '',
    // BR-008: Inactive-user policy. MVP defaults: rank filter ON, points
    // never expire. See src/modules/leaderboard/inactivityPolicy.js.
    rankFilterEnabled: parseBoolean(process.env.RANK_FILTER_ENABLED, true),
    pointsExpiryDays:
      process.env.POINTS_EXPIRY_DAYS && Number(process.env.POINTS_EXPIRY_DAYS) > 0
        ? Number(process.env.POINTS_EXPIRY_DAYS)
        : null,
    // BR-009 + BR-010: Geographic policy. MVP defaults: Mexico City,
    // Monterrey, Guadalajara; default radius 5 km. See
    // src/modules/geography/geographyPolicy.js.
    geographyConfig: loadGeographyConfig({
      ACTIVE_CITIES: process.env.ACTIVE_CITIES,
      DEFAULT_PROXIMITY_RADIUS_KM: process.env.DEFAULT_PROXIMITY_RADIUS_KM,
      SECONDARY_PROXIMITY_RADIUS_KM: process.env.SECONDARY_PROXIMITY_RADIUS_KM,
    }),
  };
}
