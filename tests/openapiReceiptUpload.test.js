import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOpenApiSpecFromRoutes,
} from '../src/docs/openapi.js';

test('buildOpenApiSpecFromRoutes documents receipt upload and restaurant receipt settings', () => {
  const spec = buildOpenApiSpecFromRoutes({
    routes: [
      { method: 'post', path: '/api/v1/admin/restaurants', sourceName: 'README.md' },
      { method: 'post', path: '/api/v1/restaurants/{restaurantId}/receipt', sourceName: 'README.md' },
    ],
    title: 'Food Route Express API',
    description: 'Swagger auth: Click `Authorize`.',
  });

  const restaurantSchema =
    spec.paths['/api/v1/admin/restaurants'].post.requestBody.content['multipart/form-data'].schema;
  assert.ok(restaurantSchema.properties.receiptUploadEnabled);
  assert.ok(restaurantSchema.properties.pointsPerReceiptUpload);

  const receiptSchema =
    spec.paths['/api/v1/restaurants/{restaurantId}/receipt'].post.requestBody.content['multipart/form-data'].schema;
  assert.deepEqual(receiptSchema.required, ['image']);
  assert.equal(receiptSchema.properties.image.format, 'binary');
});
