import fs from 'node:fs/promises';
import path from 'node:path';

import { getEndpointCatalogEntry } from './endpointCatalog.js';

const ROUTE_LINE_RE = /^\s*-\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(`?)(\/api\/v1\/[^\s`]+)\2/i;

const PUBLIC_ROUTE_PATTERNS = [
  /^\/api\/v1\/health$/,
  /^\/api\/v1\/auth\/(register|register-with-referral|resend-verify-otp|send-verification-email|verify-otp|login|forgot-password|resend-forgot-otp|send-password-reset-email|verify-forgot-otp)$/,
  /^\/api\/v1\/cms\/(about-us|privacy-policy|terms-and-conditions|terms-of-service|pages\/\{slug\})$/,
];

function isPublicRoute(method, routePath) {
  if (method === 'GET' && routePath === '/api/v1/health') {
    return true;
  }

  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(routePath));
}

function deriveTags(routePath) {
  const parts = routePath.replace(/^\/api\/v1\//, '').split('/').filter(Boolean);
  const tag = parts[0] ?? 'API';
  return [tag.replace(/^\w/, (char) => char.toUpperCase())];
}

function humanizeRoute(method, routePath) {
  const cleaned = routePath
    .replace(/^\/api\/v1\//, '')
    .replace(/\{([^}]+)\}/g, '$1')
    .split('/')
    .filter(Boolean)
    .join(' ');

  return `${method} ${cleaned}`.trim();
}

function extractPathParameters(routePath) {
  const params = [];
  const matches = routePath.matchAll(/\{([^}]+)\}/g);

  for (const match of matches) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }

  return params;
}

function parseRouteNote(note) {
  if (!note) {
    return {};
  }

  const normalized = note.replace(/\s+/g, ' ').trim();
  const details = {};

  const jsonMatch = normalized.match(/expects JSON with (.+)$/i);
  if (jsonMatch) {
    details.requestKind = 'json';
    details.fields = jsonMatch[1];
  }

  const multipartMatch = normalized.match(/expects multipart\/form-data with (.+)$/i);
  if (multipartMatch) {
    details.requestKind = 'multipart';
    details.fields = multipartMatch[1];
  }

  const queryMatch = normalized.match(/expects (.+)$/i);
  if (queryMatch && normalized.toLowerCase().includes('page') && normalized.toLowerCase().includes('pagesize')) {
    details.requestKind = 'query';
    details.fields = queryMatch[1];
  }

  if (/no JSON body/i.test(normalized) || /no body/i.test(normalized)) {
    details.requestKind = 'empty';
  }

  if (/requires Authorization/i.test(normalized)) {
    details.security = true;
  }

  return details;
}

export function extractRouteDefinitionsFromText(text, sourceName = 'unknown') {
  const routes = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ROUTE_LINE_RE);
    if (!match) {
      continue;
    }

    const note = line
      .replace(match[0], '')
      .replace(/^[\s:-]+/, '')
      .trim();

    routes.push({
      method: match[1].toLowerCase(),
      path: match[3],
      sourceName,
      note,
      details: parseRouteNote(note),
    });
  }

  return routes;
}

function normalizeExpressPath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function normalizeMountedPath(basePath, routePath) {
  const normalizedBasePath = basePath.replace(/\/+$/, '');
  const normalizedRoutePath = routePath === '/' ? '' : routePath;
  const combined = `${normalizedBasePath}${normalizedRoutePath}`;

  return normalizeExpressPath(combined || '/');
}

function parseImportedRouterModules(sourceText) {
  const imports = new Map();
  const importPattern =
    /import\s+\{([^}]+)\}\s+from\s+'([^']+)';/g;

  let match;
  while ((match = importPattern.exec(sourceText)) !== null) {
    const importedNames = match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    for (const importedName of importedNames) {
      imports.set(importedName, match[2]);
    }
  }

  return imports;
}

function parseMountedRouters(sourceText) {
  const mounts = [];
  const mountPattern =
    /app\.use\(`\$\{config\.apiV1Prefix\}([^`]+)`\s*,\s*([A-Za-z0-9_]+)\(config\)\);/g;

  let match;
  while ((match = mountPattern.exec(sourceText)) !== null) {
    mounts.push({
      basePath: `/api/v1${match[1]}`,
      routerFactoryName: match[2],
    });
  }

  return mounts;
}

function extractFunctionBlock(sourceText, functionName) {
  const signature = `export function ${functionName}`;
  const startIndex = sourceText.indexOf(signature);
  if (startIndex === -1) {
    return '';
  }

  const bodyStartIndex = sourceText.indexOf('{', startIndex);
  if (bodyStartIndex === -1) {
    return '';
  }

  let depth = 0;
  for (let index = bodyStartIndex; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return sourceText.slice(bodyStartIndex + 1, index);
      }
    }
  }

  return '';
}

function extractRouterMethodDefinitions(functionBody, sourceName) {
  const routes = [];
  const routePattern =
    /router\.(get|post|put|patch|delete|options|head)\(\s*['"]([^'"]+)['"]/g;

  let match;
  while ((match = routePattern.exec(functionBody)) !== null) {
    routes.push({
      method: match[1].toLowerCase(),
      path: match[2],
      sourceName,
      note: '',
      details: {},
    });
  }

  return routes;
}

async function collectCodeRouteDefinitions() {
  const registerRoutesFile = path.resolve('src/routes/index.js');
  const registerRoutesSource = await fs.readFile(registerRoutesFile, 'utf8');
  const importedRouterModules = parseImportedRouterModules(registerRoutesSource);
  const mountedRouters = parseMountedRouters(registerRoutesSource);
  const routes = [];
  const seen = new Set();
  const loadedModuleSources = new Map();

  for (const mount of mountedRouters) {
    const relativeModulePath = importedRouterModules.get(mount.routerFactoryName);
    if (!relativeModulePath) {
      continue;
    }

    const modulePath = path.resolve('src/routes', relativeModulePath);
    let moduleSource = loadedModuleSources.get(modulePath);
    if (!moduleSource) {
      moduleSource = await fs.readFile(modulePath, 'utf8');
      loadedModuleSources.set(modulePath, moduleSource);
    }

    const functionBody = extractFunctionBlock(moduleSource, mount.routerFactoryName);
    if (!functionBody) {
      continue;
    }

    for (const route of extractRouterMethodDefinitions(functionBody, path.basename(modulePath))) {
      const fullPath = normalizeMountedPath(mount.basePath, route.path);
      const key = `${route.method}:${fullPath}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      routes.push({
        ...route,
        path: fullPath,
      });
    }
  }

  routes.sort((left, right) => {
    if (left.path === right.path) {
      return left.method.localeCompare(right.method);
    }

    return left.path.localeCompare(right.path);
  });

  return routes;
}

export async function collectRouteDefinitions(sourceFiles) {
  const codeRoutes = await collectCodeRouteDefinitions();
  const routesByKey = new Map(
    codeRoutes.map((route) => [`${route.method}:${route.path}`, route]),
  );

  for (const sourceFile of sourceFiles) {
    const text = await fs.readFile(sourceFile, 'utf8');
    for (const route of extractRouteDefinitionsFromText(text, path.basename(sourceFile))) {
      const key = `${route.method}:${route.path}`;
      routesByKey.set(key, {
        ...(routesByKey.get(key) ?? {}),
        ...route,
      });
    }
  }

  const routes = Array.from(routesByKey.values());

  routes.sort((left, right) => {
    if (left.path === right.path) {
      return left.method.localeCompare(right.method);
    }

    return left.path.localeCompare(right.path);
  });

  const catalogOnlyRoutes = [
    { method: 'get', path: '/api/v1/users/me/challenges/available', sourceName: 'endpointCatalog', note: '' },
    { method: 'get', path: '/api/v1/users/me/notifications', sourceName: 'endpointCatalog', note: '' },
    { method: 'get', path: '/api/v1/users/me/notifications/preview', sourceName: 'endpointCatalog', note: '' },
    { method: 'get', path: '/api/v1/users/me/notifications/unread-count', sourceName: 'endpointCatalog', note: '' },
    { method: 'post', path: '/api/v1/users/me/notifications/proximity/location', sourceName: 'endpointCatalog', note: '' },
    { method: 'post', path: '/api/v1/users/me/notifications/read-all', sourceName: 'endpointCatalog', note: '' },
    { method: 'post', path: '/api/v1/users/me/notifications/{notification_id}/read', sourceName: 'endpointCatalog', note: '' },
    { method: 'get', path: '/api/v1/users/me/proximity-settings', sourceName: 'endpointCatalog', note: '' },
    { method: 'patch', path: '/api/v1/users/me/proximity-settings', sourceName: 'endpointCatalog', note: '' },
    { method: 'post', path: '/api/v1/users/me/proximity-scan', sourceName: 'endpointCatalog', note: '' },
    { method: 'post', path: '/api/v1/internal/proximity-alerts/scan', sourceName: 'endpointCatalog', note: '' },
  ];
  for (const route of catalogOnlyRoutes) {
    const key = `${route.method}:${route.path}`;
    if (!routesByKey.has(key)) {
      routesByKey.set(key, route);
      routes.push(route);
    }
  }

  return Array.from(routesByKey.values()).sort((left, right) => {
    if (left.path === right.path) {
      return left.method.localeCompare(right.method);
    }

    return left.path.localeCompare(right.path);
  });
}

export function buildOpenApiSpecFromRoutes({
  routes,
  title,
  description,
  version = '1.0.0',
  serverUrl = 'http://localhost:3000',
}) {
  const paths = {};

  for (const route of routes) {
    const catalogEntry = getEndpointCatalogEntry(route.method, route.path);
    const operation = {
      tags: deriveTags(route.path),
      summary: humanizeRoute(route.method.toUpperCase(), route.path),
      description: catalogEntry?.description ?? route.note ?? `Proxied through Express from ${route.sourceName}.`,
      operationId: `${route.method}_${route.path}`
        .replace(/[^a-zA-Z0-9_{}]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase(),
      parameters: extractPathParameters(route.path),
      responses: {
        200: { description: 'Successful response' },
        400: {
          description: 'Validation or request error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        401: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        404: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: {
          description: 'Internal error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    };

    if (catalogEntry?.requestBody) {
      operation.requestBody = catalogEntry.requestBody;
    }

    if (catalogEntry?.parameters) {
      operation.parameters = [...operation.parameters, ...catalogEntry.parameters];
    }

    if (route.details?.requestKind === 'empty' && route.method !== 'get' && route.method !== 'head') {
      operation.requestBody = {
        required: false,
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: false, properties: {} },
          },
        },
      };
    }

    if (route.method === 'post') {
      operation.responses[201] = { description: 'Created' };
    }

    if (route.method === 'delete') {
      operation.responses[204] = { description: 'Deleted' };
    }

    if (!isPublicRoute(route.method.toUpperCase(), route.path) || route.details?.security) {
      operation.security = [{ BearerAuth: [] }];
    }

    if (!paths[route.path]) {
      paths[route.path] = {};
    }

    paths[route.path][route.method] = operation;
  }

  return {
    openapi: '3.0.3',
    info: {
      title,
      version,
      description,
    },
    servers: [{ url: serverUrl }],
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the raw access token here. Swagger will add the Bearer prefix.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          additionalProperties: false,
          properties: {
            error: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { oneOf: [{ type: 'string' }, { type: 'object' }, { type: 'array' }] },
                field: { type: 'string' },
                requestId: { type: 'string' },
              },
            },
          },
          required: ['error'],
        },
      },
    },
  };
}

export async function buildOpenApiSpec({
  title,
  description,
  version,
  serverUrl,
  sourceFiles,
}) {
  const routes = await collectRouteDefinitions(sourceFiles);
  return buildOpenApiSpecFromRoutes({ routes, title, description, version, serverUrl });
}
