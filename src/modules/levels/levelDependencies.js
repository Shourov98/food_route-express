import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { FirestoreLevelRepository } from './levelRepository.js';
import { LevelService } from './levelService.js';

let cachedServicePromise;

export function getLevelService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new LevelService({
        levelRepository: new FirestoreLevelRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }
  return cachedServicePromise;
}
