import { ApplicationError } from '../../core/ApplicationError.js';
import { extractBearerToken } from '../../core/security.js';
import { messageResponse, successResponse } from '../../core/response.js';
import {
  validateChangePassword,
  validateEmail,
  validateLogin,
  validateOtp,
  validateReferralRegister,
  validateRefresh,
  validateRegister,
} from './authValidators.js';

function requireBearerToken(req) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new ApplicationError({
      code: 'invalid_authorization_header',
      message: 'Authorization header must be in the format: Bearer <token>.',
      statusCode: 401,
    });
  }
  return token;
}

export function createAuthController({ getAuthService, config }) {
  async function service() {
    return getAuthService(config);
  }

  return {
    async register(req, res) {
      const payload = validateRegister(req.body);
      const authService = await service();
      const data = await authService.register(payload);
      res.status(201).json(successResponse(data, authService.getRegistrationDeliveryMessage()));
    },

    async registerWithReferral(req, res) {
      const payload = validateReferralRegister(req.body);
      const authService = await service();
      const data = await authService.registerWithReferral(payload);
      res.status(201).json(successResponse(data, authService.getRegistrationDeliveryMessage()));
    },

    async resendVerifyOtp(req, res) {
      const { email } = validateEmail(req.body);
      const authService = await service();
      await authService.resendRegisterOtp(email);
      res.json(messageResponse(authService.getVerificationResendMessage()));
    },

    async sendVerificationEmail(req, res) {
      const { email } = validateEmail(req.body);
      const authService = await service();
      await authService.sendVerificationEmail(email);
      res.json(messageResponse('A verification email link has been sent.'));
    },

    async verifyOtp(req, res) {
      const payload = validateOtp(req.body);
      const authService = await service();
      const data = await authService.verifyRegisterOtp(payload);
      res.json(successResponse(data, 'User verification completed successfully.'));
    },

    async login(req, res) {
      const payload = validateLogin(req.body);
      const authService = await service();
      const data = await authService.login(payload);
      res.json(successResponse(data, 'Login completed successfully.'));
    },

    async refresh(req, res) {
      const { refreshToken } = validateRefresh(req.body);
      const authService = await service();
      const data = await authService.refreshSession(refreshToken);
      res.json(successResponse(data, 'Session refreshed successfully.'));
    },

    async forgotPassword(req, res) {
      const { email } = validateEmail(req.body);
      const authService = await service();
      await authService.forgotPassword(email);
      res.json(messageResponse(authService.getPasswordResetDeliveryMessage()));
    },

    async resendForgotOtp(req, res) {
      const { email } = validateEmail(req.body);
      const authService = await service();
      await authService.resendForgotPasswordOtp(email);
      res.json(messageResponse(authService.getPasswordResetResendMessage()));
    },

    async sendPasswordResetEmail(req, res) {
      const { email } = validateEmail(req.body);
      const authService = await service();
      await authService.sendPasswordResetEmail(email);
      res.json(messageResponse('A password reset email link has been sent.'));
    },

    async verifyForgotOtp(req, res) {
      const payload = validateOtp(req.body);
      const authService = await service();
      const data = await authService.verifyForgotPasswordOtp(payload);
      res.json(successResponse(data, 'Forgot-password OTP verified successfully.'));
    },

    async changePassword(req, res) {
      const payload = validateChangePassword(req.body);
      const token = requireBearerToken(req);
      const authService = await service();
      await authService.changePassword(token, payload);
      res.json(messageResponse('Password changed successfully.'));
    },
  };
}
