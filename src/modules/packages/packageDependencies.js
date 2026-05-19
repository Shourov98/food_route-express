import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreRestaurantRepository } from '../restaurants/restaurantRepository.js';
import { PackageService } from './packageService.js';

let cachedServicePromise;

export function getPackageService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new PackageService({
        restaurantRepository: new FirestoreRestaurantRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }
  return cachedServicePromise;
}
