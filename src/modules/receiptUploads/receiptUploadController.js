import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { validateReceiptUpload } from './receiptUploadValidators.js';

export function createReceiptUploadController({ getReceiptUploadService, config }) {
  async function service() {
    return getReceiptUploadService(config);
  }

  return {
    async uploadReceipt(req, res) {
      validateReceiptUpload(req.file);
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      const result = await (await service()).uploadReceipt({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        image: req.file,
        note,
      });
      res.status(201).json(successResponse(result.data, result.message));
    },
  };
}
