import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { buildPushNotificationService } from '../../infra/pushNotificationServiceFactory.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreNotificationCampaignRepository } from './notificationCampaignRepository.js';
import { NotificationCampaignService } from './notificationCampaignService.js';

let cachedServicePromise;

export function getNotificationCampaignService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      return new NotificationCampaignService({
        campaignRepository: new FirestoreNotificationCampaignRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        pushNotificationService: await buildPushNotificationService({ config, app }),
      });
    });
  }
  return cachedServicePromise;
}
