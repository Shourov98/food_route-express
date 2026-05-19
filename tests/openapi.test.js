import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOpenApiSpecFromRoutes,
  extractRouteDefinitionsFromText,
} from '../src/docs/openapi.js';

test('extractRouteDefinitionsFromText parses route bullets', () => {
  const text = `
- GET /api/v1/health
- POST /api/v1/auth/login
- GET /api/v1/admin/users/{user_id}
`;

  const routes = extractRouteDefinitionsFromText(text, 'README.md');

  assert.equal(routes.length, 3);
  assert.equal(routes[0].method, 'get');
  assert.equal(routes[0].path, '/api/v1/health');
  assert.equal(routes[0].sourceName, 'README.md');
  assert.equal(routes[0].note, '');
});

test('buildOpenApiSpecFromRoutes sets bearer security only for protected routes', () => {
  const spec = buildOpenApiSpecFromRoutes({
    routes: [
      { method: 'get', path: '/api/v1/health', sourceName: 'README.md' },
      { method: 'post', path: '/api/v1/auth/login', sourceName: 'README.md' },
      { method: 'get', path: '/api/v1/admin/users/{user_id}', sourceName: 'README.md' },
      { method: 'post', path: '/api/v1/auth/register', sourceName: 'README.md' },
      { method: 'get', path: '/api/v1/restaurants', sourceName: 'README.md' },
    ],
    title: 'Food Route Express API',
    description: 'Swagger auth: Click `Authorize`.',
  });

  assert.ok(spec.components.securitySchemes.BearerAuth);
  assert.equal(spec.paths['/api/v1/health'].get.security, undefined);
  assert.equal(spec.paths['/api/v1/auth/login'].post.security, undefined);
  assert.deepEqual(spec.paths['/api/v1/admin/users/{user_id}'].get.security, [
    { BearerAuth: [] },
  ]);
  assert.equal(
    spec.paths['/api/v1/auth/register'].post.requestBody.content['application/json'].schema.required.length,
    7,
  );
  assert.equal(spec.paths['/api/v1/restaurants'].get.parameters[0].name, 'page');
  assert.equal(spec.paths['/api/v1/restaurants'].get.parameters[1].name, 'pageSize');
  assert.equal(
    spec.paths['/api/v1/admin/users/{user_id}'].get.parameters[0].name,
    'user_id',
  );
});
