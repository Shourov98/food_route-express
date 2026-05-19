import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { FirestoreReviewRepository } from '../reviews/reviewRepository.js';
import { FirestoreFavoriteRepository } from './favoriteRepository.js';
import { FavoriteService } from './favoriteService.js';

let cachedServicePromise;

export function getFavoriteService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new FavoriteService({
        favoriteRepository: new FirestoreFavoriteRepository(firestore),
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        reviewRepository: new FirestoreReviewRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }

  return cachedServicePromise;
}
