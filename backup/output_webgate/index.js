// index.js — GPTNiX Backend V5 - Production Ready (refactored entrypoint)
'use strict';

const cluster = require('cluster');
const { NODE_ENV } = require('./src/config/env');
const { runMaster } = require('./src/server/master');
const { runWorker } = require('./src/server/worker');

// Enable clustering in production (can be disabled via DISABLE_CLUSTERING=true)
const USE_CLUSTERING = NODE_ENV === 'production' && process.env.DISABLE_CLUSTERING !== 'true';

if (USE_CLUSTERING && cluster.isMaster) {
  const numWorkers = parseInt(process.env.NUM_WORKERS, 10) || undefined;
  runMaster({ numWorkers });
} else {
  runWorker();
}
