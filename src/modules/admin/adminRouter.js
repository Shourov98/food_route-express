import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAdminController } from './adminController.js';
import { getAdminService } from './adminDependencies.js';

export function createAdminRouter(config) {
  const router = Router();
  const upload = multer();
  const controller = createAdminController({ getAdminService, config });

  router.post('/auth/seed-super-admin', asyncHandler(controller.seedSuperAdmin));
  router.post('/auth/login', asyncHandler(controller.login));
  router.post('/auth/refresh', asyncHandler(controller.refresh));
  router.post('/auth/forgot-password', asyncHandler(controller.forgotPassword));
  router.post('/auth/resend-forgot-otp', asyncHandler(controller.resendForgotOtp));
  router.post('/auth/verify-forgot-otp', asyncHandler(controller.verifyForgotOtp));
  router.post('/auth/reset-password', asyncHandler(controller.resetPassword));
  router.patch('/change-password', asyncHandler(controller.changePassword));

  router.post('/admins', upload.single('image'), asyncHandler(controller.createAdmin));
  router.get('/admins', asyncHandler(controller.listAdmins));
  router.get('/admins/:adminId', asyncHandler(controller.getAdmin));
  router.patch('/admins/:adminId', asyncHandler(controller.updateAdmin));
  router.post('/admins/:adminId/block', asyncHandler(controller.blockAdmin));
  router.post('/admins/:adminId/unblock', asyncHandler(controller.unblockAdmin));

  router.get('/profile', asyncHandler(controller.getProfile));
  router.patch('/profile', asyncHandler(controller.updateProfile));
  router.patch('/profile/image', upload.single('image'), asyncHandler(controller.uploadProfileImage));
  router.get('/dashboard/summary', asyncHandler(controller.getDashboardSummary));

  router.get('/users/blocked', asyncHandler(controller.listBlockedUsers));
  router.get('/users/:userId', asyncHandler(controller.getUser));
  router.get('/users/:userId/checkins', asyncHandler(controller.listUserCheckins));
  router.get('/users/:userId/points-history', asyncHandler(controller.listUserPointsHistory));
  router.patch('/users/:userId/points', asyncHandler(controller.adjustUserPoints));
  router.post('/users/:userId/block', asyncHandler(controller.blockUser));
  router.post('/users/:userId/unblock', asyncHandler(controller.unblockUser));
  router.get('/users', asyncHandler(controller.listUsers));

  return router;
}
