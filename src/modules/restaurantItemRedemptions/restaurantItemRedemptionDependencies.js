import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { buildPushNotificationService } from '../../infra/pushNotificationServiceFactory.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreMenuItemRepository } from '../menus/menuRepository.js';
import { FirestoreRewardRepository } from '../rewards/rewardRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestorePointsLedgerRepository, FirestoreXpLedgerRepository } from '../xp/xpRepository.js';
import { XpService } from '../xp/xpService.js';
import { FirestoreRestaurantItemRedemptionRepository } from './restaurantItemRedemptionRepository.js';
import { RestaurantItemRedemptionService } from './restaurantItemRedemptionService.js';

let cachedServicePromise;

export function getRestaurantItemRedemptionService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(async ({ app, auth, firestore }) => {
      return new RestaurantItemRedemptionService({
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        rewardRepository: new FirestoreRewardRepository(firestore),
        menuItemRepository: new FirestoreMenuItemRepository(firestore),
        redemptionRepository: new FirestoreRestaurantItemRedemptionRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
        xpService: new XpService({
          xpRepository: new FirestoreXpLedgerRepository(firestore),
          pointsRepository: new FirestorePointsLedgerRepository(firestore),
        }),
        pushNotificationService: await buildPushNotificationService({ config, app }),
      });
    });
  }

  return cachedServicePromise;
}
