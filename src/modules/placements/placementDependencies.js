import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestorePlacementRepository } from './placementRepository.js';
import { PlacementService } from './placementService.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';

let cachedServicePromise;

export function getPlacementService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new PlacementService({
        placementRepository: new FirestorePlacementRepository(firestore),
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }
  return cachedServicePromise;
}
