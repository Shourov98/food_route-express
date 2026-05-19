import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createChallengeParticipationController } from './challengeParticipationController.js';
import { getChallengeParticipationService } from './challengeParticipationDependencies.js';

export function createChallengeParticipationRouter(config) {
  const router = Router();
  const controller = createChallengeParticipationController({
    getChallengeParticipationService,
    config,
  });

  router.get('/available', asyncHandler(controller.listAvailableChallenges));
  router.post('/:challengeId/start', asyncHandler(controller.startChallenge));
  router.get('/', asyncHandler(controller.listMyParticipations));
  router.get('/:participationId', asyncHandler(controller.getMyParticipation));
  router.post('/:participationId/complete', asyncHandler(controller.completeParticipation));

  return router;
}
