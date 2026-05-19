import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { successResponse } from '../../core/response.js';

export function createChallengeParticipationController({ getChallengeParticipationService, config }) {
  async function service() {
    return getChallengeParticipationService(config);
  }

  return {
    async startChallenge(req, res) {
      const data = await (await service()).startChallenge({
        accessToken: requireBearerToken(req),
        challengeId: req.params.challengeId,
      });
      res.status(201).json(successResponse(data));
    },
    async listMyParticipations(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listMyParticipations({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
      });
      res.json(successResponse(data));
    },
    async listAvailableChallenges(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const search = req.query.search === undefined ? null : String(req.query.search);
      const data = await (await service()).listAvailableChallenges({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search,
      });
      res.json(successResponse(data));
    },
    async getMyParticipation(req, res) {
      const data = await (await service()).getMyParticipation({
        accessToken: requireBearerToken(req),
        participationId: req.params.participationId,
      });
      res.json(successResponse(data));
    },
    async completeParticipation(req, res) {
      const data = await (await service()).completeParticipation({
        accessToken: requireBearerToken(req),
        participationId: req.params.participationId,
      });
      res.json(successResponse(data));
    },
  };
}
