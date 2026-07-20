// Quick verification script: generates the OpenAPI spec and reports coverage.
import fs from 'node:fs';
import path from 'node:path';
import { buildOpenApiSpec } from '../src/docs/openapi.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const candidates = [
  path.join(here, '..', 'README.md'),
  path.join(here, '..', 'apis.md'),
  path.join(here, '..', '..', 'food_route', 'README.md'),
  path.join(here, '..', '..', 'food_route', 'apis.md'),
];
const sourceFiles = candidates.filter((p) => fs.existsSync(p));

(async () => {
  const spec = await buildOpenApiSpec({
    title: 'Food Route Express API',
    description: 'Generated verification spec.',
    serverUrl: 'http://localhost:5050',
    sourceFiles,
  });

  const paths = Object.keys(spec.paths);
  const schemas = Object.keys(spec.components.schemas);

  let withRequestBody = 0;
  let withResponseSchema = 0;
  let withExample = 0;
  let totalOperations = 0;

  for (const path of paths) {
    const methods = spec.paths[path];
    for (const method of Object.keys(methods)) {
      const op = methods[method];
      totalOperations += 1;
      if (op.requestBody) withRequestBody += 1;
      const success = op.responses?.['200'] || op.responses?.['201'] || op.responses?.['204'];
      if (success?.content?.['application/json']?.schema) withResponseSchema += 1;
      if (success?.content?.['application/json']?.example) withExample += 1;
    }
  }

  console.log('=== OpenAPI Coverage ===');
  console.log('Paths:', paths.length);
  console.log('Operations:', totalOperations);
  console.log('Components/schemas:', schemas.length);
  console.log('Operations with requestBody:', withRequestBody);
  console.log('Operations with response schema:', withResponseSchema);
  console.log('Operations with response example:', withExample);
  console.log('\n=== Sample (login POST) ===');
  console.log(JSON.stringify(spec.paths['/api/v1/auth/login']?.post ?? {}, null, 2).slice(0, 1500));
})();
