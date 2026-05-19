import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import {
  parseChallengeFilters,
  validateChallengeCreate,
  validateChallengeUpdate,
} from './challengeValidators.js';

export function createChallengeController({ getChallengeService, getChallengeParticipationService, config }) {
  async function challengeService() {
    return getChallengeService(config);
  }
  async function participationService() {
    return getChallengeParticipationService(config);
  }

  return {
    async createChallenge(req, res) {
      const data = await (await challengeService()).createChallenge({
        accessToken: requireBearerToken(req),
        payload: validateChallengeCreate(req.body),
      });
      res.status(201).json(successResponse(data));
    },
    async listChallenges(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await challengeService()).listChallenges({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseChallengeFilters(req.query),
      });
      res.json(successResponse(data));
    },
    async getChallenge(req, res) {
      const data = await (await challengeService()).getChallenge({
        accessToken: requireBearerToken(req),
        challengeId: req.params.challengeId,
      });
      res.json(successResponse(data));
    },
    async updateChallenge(req, res) {
      const data = await (await challengeService()).updateChallenge({
        accessToken: requireBearerToken(req),
        challengeId: req.params.challengeId,
        payload: validateChallengeUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async deleteChallenge(req, res) {
      await (await challengeService()).deleteChallenge({
        accessToken: requireBearerToken(req),
        challengeId: req.params.challengeId,
      });
      res.json(messageResponse('Challenge deleted successfully.'));
    },
    async getChallengeAnalytics(req, res) {
      const data = await (await participationService()).getChallengeAnalytics({
        accessToken: requireBearerToken(req),
        challengeId: req.params.challengeId,
      });
      res.json(successResponse(data));
    },
  };
}
