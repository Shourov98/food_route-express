import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirebaseImageStorage } from '../../shared/services/imageStorage.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreCheckInRepository } from '../checkins/checkinRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestoreRouteProgressRepository, FirestoreRouteRepository } from '../routes/routeRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { FirestoreReceiptUploadRepository } from './receiptUploadRepository.js';
import { ReceiptUploadService } from './receiptUploadService.js';

let cachedServicePromise;

export function getReceiptUploadService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      const { getStorage } = await import('firebase-admin/storage');
      return new ReceiptUploadService({
        receiptUploadRepository: new FirestoreReceiptUploadRepository(firestore),
        checkinRepository: new FirestoreCheckInRepository(firestore),
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        routeRepository: new FirestoreRouteRepository(firestore),
        routeProgressRepository: new FirestoreRouteProgressRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        imageStorage: new FirebaseImageStorage({
          storage: getStorage(app),
          config,
        }),
        xpService: new XpService({
          xpRepository: new FirestoreXpLedgerRepository(firestore),
          pointsRepository: new FirestorePointsLedgerRepository(firestore),
        }),
      });
    });
  }
  return cachedServicePromise;
}
