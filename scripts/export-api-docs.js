import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildOpenApiSpecFromRoutes,
  collectRouteDefinitions,
} from '../src/docs/openapi.js';

const API_PREFIX = '/api/v1';
const OUTPUT_COLLECTION = path.resolve('food-route.postman_collection.json');
const OUTPUT_MARKDOWN = path.resolve('api-endpoints.md');

function normalizeRouteKey(method, routePath) {
  return `${method.toUpperCase()} ${routePath.replace(/\?.*$/, '').replace(/\{[^}]+\}/g, '{}')}`;
}

function routePreferenceScore(route) {
  let score = 0;

  if (route.sourceName.endsWith('.js')) {
    score += 4;
  }

  if (!route.path.includes('_')) {
    score += 2;
  }

  if (!route.path.includes('?')) {
    score += 1;
  }

  return score;
}

function dedupeRoutes(routes) {
  const bestByKey = new Map();

  for (const route of routes) {
    const cleanedPath = route.path.replace(/\?.*$/, '');
    const candidate = { ...route, path: cleanedPath };
    const key = normalizeRouteKey(route.method, cleanedPath);
    const existing = bestByKey.get(key);

    if (!existing || routePreferenceScore(candidate) > routePreferenceScore(existing)) {
      bestByKey.set(key, candidate);
    }
  }

  return Array.from(bestByKey.values()).sort((left, right) => {
    if (left.path === right.path) {
      return left.method.localeCompare(right.method);
    }

    return left.path.localeCompare(right.path);
  });
}

function titleCase(value) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function folderNameForPath(routePath) {
  const parts = routePath.replace(`${API_PREFIX}/`, '').split('/').filter(Boolean);

  if (parts[0] === 'admin') {
    return `Admin / ${titleCase(parts[1] ?? 'General')}`;
  }

  if (parts[0] === 'users' && parts[1] === 'me') {
    return `Users / ${titleCase(parts[2] ?? 'Profile')}`;
  }

  if (parts[0] === 'internal') {
    return `Internal / ${titleCase(parts[1] ?? 'Jobs')}`;
  }

  return titleCase(parts[0] ?? 'General');
}

function requestName(method, routePath) {
  const suffix = routePath.replace(`${API_PREFIX}/`, '');
  return `${method.toUpperCase()} ${suffix}`;
}

function rawPathToPostman(rawPath) {
  return rawPath.replace(/\{([^}]+)\}/g, '{{$1}}');
}

function exampleValueFromSchema(schema = {}, fallbackName = 'value') {
  if (schema.example !== undefined) {
    return schema.example;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  switch (schema.type) {
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      if (fallbackName.toLowerCase().includes('email')) {
        return 'user@example.com';
      }
      if (fallbackName.toLowerCase().includes('password')) {
        return 'Password123';
      }
      if (fallbackName.toLowerCase().includes('otp')) {
        return '1234';
      }
      return `sample_${fallbackName}`;
  }
}

function bodyFromJsonSchema(content) {
  const schema = content?.schema ?? {};
  const example =
    content?.examples?.default?.value ??
    content?.example;

  if (example) {
    return JSON.stringify(example, null, 2);
  }

  const properties = schema.properties ?? {};
  const payload = {};

  for (const [name, propertySchema] of Object.entries(properties)) {
    payload[name] = exampleValueFromSchema(propertySchema, name);
  }

  return JSON.stringify(payload, null, 2);
}

function formDataFromSchema(content) {
  const schema = content?.schema ?? {};
  const properties = schema.properties ?? {};

  return Object.entries(properties).map(([name, propertySchema]) => {
    const isBinary = propertySchema.format === 'binary';

    return {
      key: name,
      type: isBinary ? 'file' : 'text',
      value: isBinary ? undefined : String(exampleValueFromSchema(propertySchema, name)),
      src: isBinary ? [] : undefined,
    };
  });
}

function buildRequest(routePath, method, operation) {
  const headers = [
    { key: 'Accept', value: 'application/json' },
  ];

  if (operation.security?.length) {
    const tokenVar = routePath.startsWith(`${API_PREFIX}/admin/`) ? 'adminAccessToken' : 'accessToken';
    headers.push({ key: 'Authorization', value: `Bearer {{${tokenVar}}}` });
  }

  if (routePath === `${API_PREFIX}/internal/proximity-alerts/scan`) {
    headers.push({ key: 'X-Internal-Job-Secret', value: '{{internalJobSecret}}' });
  }

  let body;
  if (operation.requestBody?.content?.['application/json']) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
    body = {
      mode: 'raw',
      raw: bodyFromJsonSchema(operation.requestBody.content['application/json']),
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  } else if (operation.requestBody?.content?.['multipart/form-data']) {
    body = {
      mode: 'formdata',
      formdata: formDataFromSchema(operation.requestBody.content['multipart/form-data']),
    };
  }

  const pathVariables = Array.from(routePath.matchAll(/\{([^}]+)\}/g)).map((match) => ({
    key: match[1],
    value: match[1],
  }));

  const query = (operation.parameters ?? [])
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => ({
      key: parameter.name,
      value: String(exampleValueFromSchema(parameter.schema, parameter.name)),
      description: parameter.description,
      disabled: !parameter.required,
    }));

  return {
    name: requestName(method, routePath),
    request: {
      method: method.toUpperCase(),
      header: headers,
      body,
      description: operation.description,
      url: {
        raw: `{{baseUrl}}${rawPathToPostman(routePath)}`,
        host: ['{{baseUrl}}'],
        path: routePath.replace(/^\//, '').split('/'),
        query,
        variable: pathVariables,
      },
    },
    response: [],
  };
}

function buildCollection(spec) {
  const folders = new Map();

  for (const [routePath, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const folderName = folderNameForPath(routePath);
      if (!folders.has(folderName)) {
        folders.set(folderName, []);
      }

      folders.get(folderName).push(buildRequest(routePath, method, operation));
    }
  }

  const items = Array.from(folders.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([name, requests]) => ({
      name,
      item: requests.sort((left, right) => left.name.localeCompare(right.name)),
    }));

  return {
    info: {
      name: 'Food Route API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: 'Generated from the Express/Firebase Functions route catalog.',
    },
    variable: [
      { key: 'baseUrl', value: 'http://localhost:5001/foodrute/us-central1' },
      { key: 'accessToken', value: '' },
      { key: 'adminAccessToken', value: '' },
      { key: 'internalJobSecret', value: '' },
    ],
    item: items,
  };
}

function buildMarkdown(routes) {
  const groups = new Map();

  for (const route of routes) {
    const group = folderNameForPath(route.path);
    if (!groups.has(group)) {
      groups.set(group, []);
    }

    groups.get(group).push(route);
  }

  const lines = [
    '# Food Route API Endpoints',
    '',
    `Total unique endpoints: ${routes.length}`,
    '',
  ];

  for (const [group, groupRoutes] of Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push(`## ${group}`);
    lines.push('');

    for (const route of groupRoutes.sort((left, right) => {
      if (left.path === right.path) {
        return left.method.localeCompare(right.method);
      }

      return left.path.localeCompare(right.path);
    })) {
      lines.push(`- ${route.method.toUpperCase()} ${route.path}`);
    }

    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

async function main() {
  const routes = dedupeRoutes(await collectRouteDefinitions([]));
  const spec = buildOpenApiSpecFromRoutes({
    routes,
    title: 'Food Route API',
    description: 'Generated from the Express/Firebase Functions backend.',
    serverUrl: '{{baseUrl}}',
  });
  const collection = buildCollection(spec);
  const markdown = buildMarkdown(routes);

  await fs.writeFile(OUTPUT_COLLECTION, `${JSON.stringify(collection, null, 2)}\n`);
  await fs.writeFile(OUTPUT_MARKDOWN, markdown);

  console.log(
    JSON.stringify(
      {
        endpointCount: routes.length,
        collectionPath: OUTPUT_COLLECTION,
        markdownPath: OUTPUT_MARKDOWN,
      },
      null,
      2,
    ),
  );
}

await main();
