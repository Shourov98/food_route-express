import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { FirestoreCheckInRepository } from './checkinRepository.js';
import { CheckInService } from './checkinService.js';

let cachedServicePromise;

export function getCheckInService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new CheckInService({
        checkinRepository: new FirestoreCheckInRepository(firestore),
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        xpService: new XpService({
          xpRepository: new FirestoreXpLedgerRepository(firestore),
          pointsRepository: new FirestorePointsLedgerRepository(firestore),
        }),
      });
    });
  }
  return cachedServicePromise;
}
