'use strict';

const cluster = require('cluster');
const { PORT } = require('../config/env');
const { createApp } = require('../app');
const { registerRoutes } = require('../routes');
const { attachGracefulShutdown } = require('./graceful');
const { logStartupEnvironmentOnce, logStartupSummary } = require('./startup');
const { startQdrantKeepAlive } = require('../services/qdrantKeepAlive');

function buildApp() {
  const app = createApp();
  registerRoutes(app);
  return app;
}

function runWorker() {
  const isWorker = cluster.isWorker;

  // In single-process mode (development), log environment + nice summary once.
  if (!isWorker) {
    logStartupEnvironmentOnce();
  }

  const app = buildApp();

  // Keep managed Qdrant instances awake (prevents "suspend due to inactivity")
  startQdrantKeepAlive();

  const server = app.listen(PORT, () => {
    if (!isWorker) {
      logStartupSummary({ mode: 'development', clustering: false });
    } else {
      console.log(`✅ Worker ${process.pid} ready on port ${PORT}`);
    }
  });

  attachGracefulShutdown({
    server,
    isWorker,
    pid: process.pid,
    timeoutMs: 10000,
  });

  return server;
}

module.exports = { runWorker, buildApp };
