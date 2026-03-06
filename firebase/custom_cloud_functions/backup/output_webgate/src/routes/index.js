'use strict';

const { createRootRouter } = require('./root');
const { createChatRouter } = require('./chat');
const { createBillingRouter } = require('./billing');
const { createAdminBillingRouter } = require('./adminBilling');
const { createAdminAccessRouter } = require('./adminAccess');
const { verifyFirebaseToken } = require('../middleware/auth');
const { standardRateLimit, strictRateLimit } = require('../middleware/rateLimitV2');
const { createRagRouter } = require('./rag');
const { createHealthRouter } = require('./health');
const { createZipRouter } = require('./zip');
const { createImageRouter } = require('./image');
const { createWebRouter } = require('./web');
const { createVoiceRouter } = require('./voice');
const { createToolsWeatherRouter } = require('./toolsWeather');
const { createToolsFxRouter } = require('./toolsFx');
const { createToolsWikiRouter } = require('./toolsWiki');
const { createToolsDbpediaRouter } = require('./toolsDbpedia');
const { createToolsHolidaysRouter } = require('./toolsHolidays');
const { createToolsOsmRouter } = require('./toolsOsm');
const { createToolsGeoapifyRouter } = require('./toolsGeoapify');
const { createToolsMoviesRouter } = require('./toolsMovies');
const { createToolsCarsRouter } = require('./toolsCars');

function registerRoutes(app) {
  app.use('/', createRootRouter());
  
  // 🔒 SECURITY FIX: Require authentication + rate limiting for chat endpoint
  // - verifyFirebaseToken: Prevents spoofed userId and unauthorized access
  // - strictRateLimit: 20 req/min per user (expensive LLM calls)
  app.use('/', verifyFirebaseToken, strictRateLimit, createChatRouter());

  // Admin access helpers (whoami + bootstrap)
  app.use('/admin', createAdminAccessRouter());
  // Billing (admin + user)
  app.use('/billing', verifyFirebaseToken, createBillingRouter());
  app.use('/admin/billing', verifyFirebaseToken, createAdminBillingRouter());

  app.use('/voice', standardRateLimit, createVoiceRouter());
  app.use('/', standardRateLimit, createRagRouter());
  app.use('/', createHealthRouter());
  app.use('/', strictRateLimit, createImageRouter()); // Image gen is expensive
  app.use('/', createWebRouter());

  // Tools
  app.use('/tools/zip', createZipRouter());
  app.use('/tools/weather', createToolsWeatherRouter());
  app.use('/tools/fx', createToolsFxRouter());
  app.use('/tools/wiki', createToolsWikiRouter());
  app.use('/tools/dbpedia', createToolsDbpediaRouter());
  app.use('/tools/holidays', createToolsHolidaysRouter());
  app.use('/tools/osm', createToolsOsmRouter());
  app.use('/tools/geoapify', createToolsGeoapifyRouter());
  app.use('/tools/movies', createToolsMoviesRouter());
  app.use('/tools/cars', createToolsCarsRouter());
}

module.exports = { registerRoutes };
