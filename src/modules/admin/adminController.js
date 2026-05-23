import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import {
  parseAdminUserFilters,
  parseDashboardSummaryQuery,
  validateAdminCreate,
  validateAdminLogin,
  validateAdminUpdate,
  validateChangePassword,
  validateEmail,
  validateOptionalSuperAdminSeed,
  validateOtp,
  validatePointsAdjustment,
  validateRefresh,
  validateResetPassword,
} from './adminValidators.js';

export function createAdminController({ getAdminService, config }) {
  async function service() {
    return getAdminService(config);
  }

  return {
    async seedSuperAdmin(req, res) {
      const data = await (await service()).seedSuperAdmin(validateOptionalSuperAdminSeed(req.body));
      res.status(201).json(successResponse(data, 'Super admin seeded successfully.'));
    },
    async login(req, res) {
      const data = await (await service()).login(validateAdminLogin(req.body));
      res.json(successResponse(data, 'Admin login completed successfully.'));
    },
    async refresh(req, res) {
      const data = await (await service()).refreshSession(validateRefresh(req.body).refreshToken);
      res.json(successResponse(data, 'Admin session refreshed successfully.'));
    },
    async forgotPassword(req, res) {
      await (await service()).forgotPassword(validateEmail(req.body).email);
      res.json(messageResponse('An admin forgot-password OTP has been sent.'));
    },
    async resendForgotOtp(req, res) {
      await (await service()).resendForgotPasswordOtp(validateEmail(req.body).email);
      res.json(messageResponse('A new admin forgot-password OTP has been sent.'));
    },
    async verifyForgotOtp(req, res) {
      const payload = validateOtp(req.body);
      const data = await (await service()).verifyForgotPasswordOtp(payload.email, payload.otp);
      res.json(successResponse(data, 'Admin forgot-password OTP verified successfully.'));
    },
    async resetPassword(req, res) {
      await (await service()).resetPasswordAfterOtp(validateResetPassword(req.body));
      res.json(messageResponse('Admin password has been reset successfully.'));
    },
    async changePassword(req, res) {
      await (await service()).changePassword({
        accessToken: requireBearerToken(req),
        payload: validateChangePassword(req.body),
      });
      res.json(messageResponse('Admin password changed successfully.'));
    },
    async createAdmin(req, res) {
      const data = await (await service()).createAdmin({
        accessToken: requireBearerToken(req),
        payload: validateAdminCreate(req.body),
      });
      res.status(201).json(successResponse(data, 'Admin created successfully.'));
    },
    async listAdmins(req, res) {
      const data = await (await service()).listAdmins({
        accessToken: requireBearerToken(req),
        blockedOnly: req.query.blockedOnly === 'true' || req.query.blockedOnly === true,
      });
      res.json(successResponse(data));
    },
    async getAdmin(req, res) {
      const data = await (await service()).getAdmin({
        accessToken: requireBearerToken(req),
        adminId: req.params.adminId,
      });
      res.json(successResponse(data));
    },
    async updateAdmin(req, res) {
      const data = await (await service()).updateAdmin({
        accessToken: requireBearerToken(req),
        adminId: req.params.adminId,
        payload: validateAdminUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async blockAdmin(req, res) {
      const data = await (await service()).blockAdmin({
        accessToken: requireBearerToken(req),
        adminId: req.params.adminId,
      });
      res.json(successResponse(data));
    },
    async unblockAdmin(req, res) {
      const data = await (await service()).unblockAdmin({
        accessToken: requireBearerToken(req),
        adminId: req.params.adminId,
      });
      res.json(successResponse(data));
    },
    async getProfile(req, res) {
      const data = await (await service()).getProfile({ accessToken: requireBearerToken(req) });
      res.json(successResponse(data));
    },
    async updateProfile(req, res) {
      const data = await (await service()).updateProfile({
        accessToken: requireBearerToken(req),
        payload: validateAdminUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async uploadProfileImage(req, res) {
      const data = await (await service()).uploadProfileImage({
        accessToken: requireBearerToken(req),
        image: req.file,
      });
      res.json(successResponse(data, 'Admin profile image uploaded successfully.'));
    },
    async getDashboardSummary(req, res) {
      const query = parseDashboardSummaryQuery(req.query);
      const data = await (await service()).getDashboardSummary({
        accessToken: requireBearerToken(req),
        dashboardRange: query.range,
        year: query.year,
        month: query.month,
      });
      res.json(successResponse(data));
    },
    async listUsers(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listUsers({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        filters: parseAdminUserFilters(req.query),
        blockedOnly: false,
      });
      res.json(successResponse(data));
    },
    async listBlockedUsers(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listUsers({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        filters: parseAdminUserFilters(req.query),
        blockedOnly: true,
      });
      res.json(successResponse(data));
    },
    async getUser(req, res) {
      const data = await (await service()).getUser({
        accessToken: requireBearerToken(req),
        userId: req.params.userId,
      });
      res.json(successResponse(data));
    },
    async listUserCheckins(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listUserCheckins({
        accessToken: requireBearerToken(req),
        userId: req.params.userId,
        page,
        pageSize,
      });
      res.json(successResponse(data));
    },
    async listUserPointsHistory(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listUserPointsHistory({
        accessToken: requireBearerToken(req),
        userId: req.params.userId,
        page,
        pageSize,
      });
      res.json(successResponse(data));
    },
    async adjustUserPoints(req, res) {
      const data = await (await service()).adjustUserPoints({
        accessToken: requireBearerToken(req),
        userId: req.params.userId,
        payload: validatePointsAdjustment(req.body),
      });
      res.json(successResponse(data));
    },
    async blockUser(req, res) {
      const data = await (await service()).blockUser({
        accessToken: requireBearerToken(req),
        userId: req.params.userId,
      });
      res.json(successResponse(data));
    },
    async unblockUser(req, res) {
      const data = await (await service()).unblockUser({
        accessToken: requireBearerToken(req),
        userId: req.params.userId,
      });
      res.json(successResponse(data));
    },
  };
}
