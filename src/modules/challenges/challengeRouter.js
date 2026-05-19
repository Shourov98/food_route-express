import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createChallengeController } from './challengeController.js';
import {
  getChallengeParticipationService,
  getChallengeService,
} from './challengeDependencies.js';

export function createChallengeRouter(config) {
  const router = Router();
  const controller = createChallengeController({
    getChallengeService,
    getChallengeParticipationService,
    config,
  });

  router.post('/', asyncHandler(controller.createChallenge));
  router.get('/', asyncHandler(controller.listChallenges));
  router.get('/:challengeId/analytics', asyncHandler(controller.getChallengeAnalytics));
  router.get('/:challengeId', asyncHandler(controller.getChallenge));
  router.patch('/:challengeId', asyncHandler(controller.updateChallenge));
  router.delete('/:challengeId', asyncHandler(controller.deleteChallenge));

  return router;
}
