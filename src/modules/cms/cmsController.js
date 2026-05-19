import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { validateCmsCreate, validateCmsUpdate, validateCmsUpsert } from './cmsValidators.js';

export function createCmsController({ getCmsService, config }) {
  async function service() {
    return getCmsService(config);
  }

  return {
    async getAboutUs(req, res) {
      res.json(successResponse(await (await service()).getAboutUs()));
    },
    async upsertAboutUs(req, res) {
      const data = await (await service()).upsertAboutUs({
        accessToken: requireBearerToken(req),
        payload: validateCmsUpsert(req.body),
      });
      res.json(successResponse(data));
    },
    async getPrivacyPolicy(req, res) {
      res.json(successResponse(await (await service()).getPrivacyPolicy()));
    },
    async upsertPrivacyPolicy(req, res) {
      const data = await (await service()).upsertPrivacyPolicy({
        accessToken: requireBearerToken(req),
        payload: validateCmsUpsert(req.body),
      });
      res.json(successResponse(data));
    },
    async getTermsAndConditions(req, res) {
      res.json(successResponse(await (await service()).getTermsAndConditions()));
    },
    async getTermsOfService(req, res) {
      res.json(successResponse(await (await service()).getTermsAndConditions()));
    },
    async upsertTermsAndConditions(req, res) {
      const data = await (await service()).upsertTermsAndConditions({
        accessToken: requireBearerToken(req),
        payload: validateCmsUpsert(req.body),
      });
      res.json(successResponse(data));
    },
    async getPageBySlug(req, res) {
      res.json(successResponse(await (await service()).getPageBySlug(req.params.slug)));
    },
    async listPages(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listPages({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search,
      });
      res.json(successResponse(data));
    },
    async createPage(req, res) {
      const data = await (await service()).createPage({
        accessToken: requireBearerToken(req),
        payload: validateCmsCreate(req.body),
      });
      res.json(successResponse(data));
    },
    async updatePage(req, res) {
      const data = await (await service()).updatePage({
        accessToken: requireBearerToken(req),
        slug: req.params.slug,
        payload: validateCmsUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async deletePage(req, res) {
      await (await service()).deletePage({
        accessToken: requireBearerToken(req),
        slug: req.params.slug,
      });
      res.json(messageResponse('CMS page deleted successfully.'));
    },
  };
}
