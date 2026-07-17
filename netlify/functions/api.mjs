import { createRequire } from 'node:module';
import serverless from 'serverless-http';

const require = createRequire(import.meta.url);
const { app } = require('../../server.js');

export default serverless(app);

export const config = {
  path: '/api/*',
};
