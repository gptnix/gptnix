'use strict';

const cluster = require('cluster');
const os = require('os');
const { logStartupEnvironmentOnce, logStartupSummary } = require('./startup');

function runMaster({ numWorkers }) {
  const numCPUs = os.cpus().length;
  const workersToSpawn = numWorkers || numCPUs;

  // One-time logs in production: environment + startup summary.
  logStartupEnvironmentOnce();
  logStartupSummary({ mode: 'production', clustering: true, workers: workersToSpawn });

  console.log(`🚀 Master process ${process.pid} starting...`);
  console.log(`📊 CPUs detected: ${numCPUs}`);
  console.log(`👷 Spawning ${workersToSpawn} worker processes...\n`);

  for (let i = 0; i < workersToSpawn; i++) {
    const worker = cluster.fork();
    console.log(`✅ Worker ${worker.process.pid} started (${i + 1}/${workersToSpawn})`);
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`\n⚠️  Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
    console.log('🔄 Spawning replacement worker...\n');

    const newWorker = cluster.fork();
    console.log(`✅ Replacement worker ${newWorker.process.pid} started`);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');

    Object.values(cluster.workers || {}).forEach((w) => {
      if (w) w.kill('SIGTERM');
    });

    setTimeout(() => {
      console.log('⚠️  Forcing shutdown after timeout');
      process.exit(0);
    }, 30000).unref?.();
  });

  console.log('\n✅ Master process ready. Workers handling requests.\n');
}

module.exports = { runMaster };
