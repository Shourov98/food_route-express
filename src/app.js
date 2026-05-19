import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { buildOpenApiSpec } from './docs/openapi.js';
import { renderSwaggerUiHtml } from './docs/swaggerUiHtml.js';
import { loadConfig } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { registerRoutes } from './routes/index.js';

function createRequestIdMiddleware() {
  return (req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  };
}

function createCorsOptions(config) {
  if (config.corsAllowOrigins.includes('*')) {
    return { origin: true, credentials: config.corsAllowCredentials };
  }

  return {
    origin: config.corsAllowOrigins,
    credentials: config.corsAllowCredentials,
  };
}

function resolveOpenApiSourceFiles(sourceFiles) {
  if (Array.isArray(sourceFiles) && sourceFiles.length > 0) {
    return sourceFiles;
  }

  const candidates = [
    fileURLToPath(new URL('../README.md', import.meta.url)),
    fileURLToPath(new URL('../apis.md', import.meta.url)),
    fileURLToPath(new URL('../../food_route/README.md', import.meta.url)),
    fileURLToPath(new URL('../../food_route/apis.md', import.meta.url)),
  ];

  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function resolveRequestOrigin(req, config) {
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = forwardedHost ? forwardedHost.split(',')[0].trim() : req.get('host');

  if (protocol && host) {
    return `${protocol}://${host}`;
  }

  return `http://localhost:${config.port}`;
}

export function createApp(overrides = {}) {
  const config = { ...loadConfig(), ...overrides };
  const app = express();

  app.disable('x-powered-by');
  app.use(createRequestIdMiddleware());
  app.use(cors(createCorsOptions(config)));
  app.use(express.json({ limit: config.requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }));

  app.get(`${config.apiV1Prefix}/health`, (req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/openapi.json', async (req, res, next) => {
    try {
      const sourceFiles = resolveOpenApiSourceFiles(overrides.sourceFiles);
      const spec = await buildOpenApiSpec({
        title: config.swaggerTitle,
        description: config.swaggerDescription,
        version: '1.0.0',
        serverUrl: resolveRequestOrigin(req, config),
        sourceFiles,
      });
      res.json(spec);
    } catch (error) {
      next(error);
    }
  });

  app.get('/docs', (req, res) => {
    res.type('html').send(renderSwaggerUiHtml({ title: config.swaggerTitle }));
  });

  registerRoutes(app, config);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
