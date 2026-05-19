import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreFavoriteRepository } from '../favorites/favoriteRepository.js';
import { FirestoreMenuItemRepository, FirestoreMenuRepository } from '../menus/menuRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestoreReviewRepository } from '../reviews/reviewRepository.js';
import { RestaurantDiscoveryService } from './restaurantDiscoveryService.js';

let cachedServicePromise;

export function getRestaurantDiscoveryService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new RestaurantDiscoveryService({
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        menuRepository: new FirestoreMenuRepository(firestore),
        menuItemRepository: new FirestoreMenuItemRepository(firestore),
        reviewRepository: new FirestoreReviewRepository(firestore),
        favoriteRepository: new FirestoreFavoriteRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }

  return cachedServicePromise;
}
