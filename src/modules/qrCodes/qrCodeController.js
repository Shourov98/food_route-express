import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';

export function createQrCodeController({ getQrCodeService, config }) {
  async function service() {
    return getQrCodeService(config);
  }

  return {
    async list(req, res) {
      res.json(successResponse(await (await service()).listQrCodes({ accessToken: requireBearerToken(req) })));
    },
    async details(req, res) {
      res.json(
        successResponse(
          await (await service()).getQrDetails({
            accessToken: requireBearerToken(req),
            restaurantId: req.params.restaurantId,
          }),
        ),
      );
    },
    async image(req, res) {
      const content = await (await service()).exportQrImage({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
      });
      res
        .type('png')
        .setHeader('Content-Disposition', `attachment; filename="${req.params.restaurantId}-qr.png"`)
        .send(content);
    },
    async pdf(req, res) {
      const content = await (await service()).exportQrPdf({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
      });
      res
        .type('application/pdf')
        .setHeader('Content-Disposition', `attachment; filename="${req.params.restaurantId}-qr.pdf"`)
        .send(content);
    },
  };
}
