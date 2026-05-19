import { onRequest } from 'firebase-functions/v2/https';

import { createApp } from './src/app.js';

const app = createApp();

export const api = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  app,
);
