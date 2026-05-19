import process from 'node:process';

import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp();

app.listen(config.port, () => {
  process.stdout.write(`Express backend listening on port ${config.port}\n`);
});
