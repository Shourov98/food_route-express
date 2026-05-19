import process from 'node:process';

import {
  FirebasePushNotificationService,
  LoggingPushNotificationService,
  OneSignalPushNotificationService,
} from './pushNotificationService.js';

export async function buildPushNotificationService({ config, app = null }) {
  if (config.pushNotificationProvider === 'onesignal') {
    if (!config.onesignalAppId || !config.onesignalRestApiKey) {
      process.stderr.write(
        '[push] OneSignal provider selected but ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is missing. Falling back to logging.\n',
      );
      return new LoggingPushNotificationService();
    }

    return new OneSignalPushNotificationService({
      appId: config.onesignalAppId,
      apiKey: config.onesignalRestApiKey,
      apiUrl: config.onesignalApiUrl,
    });
  }

  if (config.firebaseUseEmulators || !app) {
    return new LoggingPushNotificationService();
  }

  const { getMessaging } = await import('firebase-admin/messaging');
  return new FirebasePushNotificationService({ messaging: getMessaging(app) });
}
