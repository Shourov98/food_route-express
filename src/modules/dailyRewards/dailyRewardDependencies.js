import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirebaseImageStorage } from '../../shared/services/imageStorage.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreDailyRewardRepository } from './dailyRewardRepository.js';
import { DailyRewardService } from './dailyRewardService.js';

let cachedServicePromise;

export function getDailyRewardService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      const { getStorage } = await import('firebase-admin/storage');
      return new DailyRewardService({
        dailyRewardRepository: new FirestoreDailyRewardRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        imageStorage: new FirebaseImageStorage({
          storage: getStorage(app),
          config,
        }),
      });
    });
  }
  return cachedServicePromise;
}
