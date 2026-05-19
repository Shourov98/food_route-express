import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createCmsController } from './cmsController.js';
import { getCmsService } from './cmsDependencies.js';

export function createCmsRouter(config) {
  const router = Router();
  const controller = createCmsController({ getCmsService, config });

  router.get('/about-us', asyncHandler(controller.getAboutUs));
  router.put('/admin/about-us', asyncHandler(controller.upsertAboutUs));
  router.get('/privacy-policy', asyncHandler(controller.getPrivacyPolicy));
  router.put('/admin/privacy-policy', asyncHandler(controller.upsertPrivacyPolicy));
  router.get('/terms-and-conditions', asyncHandler(controller.getTermsAndConditions));
  router.get('/terms-of-service', asyncHandler(controller.getTermsOfService));
  router.put('/admin/terms-and-conditions', asyncHandler(controller.upsertTermsAndConditions));
  router.get('/pages/:slug', asyncHandler(controller.getPageBySlug));
  router.get('/admin/pages', asyncHandler(controller.listPages));
  router.post('/admin/pages', asyncHandler(controller.createPage));
  router.patch('/admin/pages/:slug', asyncHandler(controller.updatePage));
  router.delete('/admin/pages/:slug', asyncHandler(controller.deletePage));

  return router;
}
