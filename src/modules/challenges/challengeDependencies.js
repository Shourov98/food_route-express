import { getFirebaseClients } from '../../infra/firebase.js';
import { FirebaseIdentityProvider } from '../../infra/identityProvider.js';
import { FirestoreUserRepository } from '../auth/authRepository.js';
import { getChallengeParticipationService } from '../challengeParticipations/challengeParticipationDependencies.js';
import { FirestoreRewardRepository } from '../rewards/rewardRepository.js';
import { ChallengeService } from './challengeService.js';
import { FirestoreChallengeRepository } from './challengeRepository.js';

let cachedServicePromise;

export function getChallengeService(config) {
  if (!cachedServicePromise) {
    cachedServicePromise = getFirebaseClients(config).then(({ auth, firestore }) => {
      return new ChallengeService({
        challengeRepository: new FirestoreChallengeRepository(firestore),
        rewardRepository: new FirestoreRewardRepository(firestore),
        userRepository: new FirestoreUserRepository(firestore),
        identityProvider: new FirebaseIdentityProvider({ auth, config }),
      });
    });
  }
  return cachedServicePromise;
}

export { getChallengeParticipationService };
