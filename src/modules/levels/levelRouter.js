import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createLevelController } from './levelController.js';
import { getLevelService } from './levelDependencies.js';

export function createLevelRouter(config) {
  const router = Router();
  const controller = createLevelController({ getLevelService, config });

  router.get('/', asyncHandler(controller.listLevels));
  router.get('/config', asyncHandler(controller.getConfig));
  router.post('/', asyncHandler(controller.createLevel));
  router.get('/:levelId', asyncHandler(controller.getLevel));
  router.patch('/:levelId', asyncHandler(controller.updateLevel));
  router.delete('/:levelId', asyncHandler(controller.deleteLevel));

  return router;
}
