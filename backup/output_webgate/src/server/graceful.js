'use strict';

function attachGracefulShutdown({ server, isWorker, pid, timeoutMs = 10000 }) {
  const who = isWorker ? `Worker ${pid}` : 'Server';

  const gracefulShutdown = () => {
    console.log(`\n🛑 ${who} shutting down...`);

    server.close(() => {
      console.log('✅ Server closed gracefully');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, timeoutMs).unref?.();
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    gracefulShutdown();
  });

  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled rejection:', reason);
  });

  return gracefulShutdown;
}

module.exports = { attachGracefulShutdown };
