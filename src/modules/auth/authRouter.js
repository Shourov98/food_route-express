import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthController } from './authController.js';
import { getAuthService } from './authDependencies.js';

export function createAuthRouter(config) {
  const router = Router();
  const controller = createAuthController({ getAuthService, config });

  router.post('/register', asyncHandler(controller.register));
  router.post('/register-with-referral', asyncHandler(controller.registerWithReferral));
  router.post('/resend-verify-otp', asyncHandler(controller.resendVerifyOtp));
  router.post('/send-verification-email', asyncHandler(controller.sendVerificationEmail));
  router.post('/verify-otp', asyncHandler(controller.verifyOtp));
  router.post('/login', asyncHandler(controller.login));
  router.post('/refresh', asyncHandler(controller.refresh));
  router.post('/forgot-password', asyncHandler(controller.forgotPassword));
  router.post('/resend-forgot-otp', asyncHandler(controller.resendForgotOtp));
  router.post('/send-password-reset-email', asyncHandler(controller.sendPasswordResetEmail));
  router.post('/verify-forgot-otp', asyncHandler(controller.verifyForgotOtp));
  router.post('/change-password', asyncHandler(controller.changePassword));
  router.post('/reset-password', asyncHandler(controller.resetPassword));

  return router;
}
