'use strict';

/**
 * Provider Wrappers - Integration Layer (CJS)
 *
 * Purpose:
 * - Wrap existing providers (serper, tavily, ddg) for new webSearch API
 * - Normalize provider responses to consistent format
 * - Handle readWebPage functionality
 */

const { searchSerper } = require('./providers/serper');
const { searchTavily } = require('./providers/tavily');
const { searchDDG } = require('./providers/ddg');
const { readWebPageWithFallback } = require('./reader');

/**
 * Create provider instances for webSearch
 * @returns {object} Providers object
 */
function createProviders() {
  return {
    serper: {
      search: async (query, options = {}) => {
        const results = await searchSerper(query, {
          num: options.max_results || options.maxResults || 10,
        });
        return normalizeResults(results, 'serper');
      },
    },

    tavily: {
      search: async (query, options = {}) => {
        const results = await searchTavily(query, {
          max_results: options.max_results || options.maxResults || 10,
          include_images: Boolean(options.include_images || options.includeImages),
          include_image_descriptions: Boolean(
            options.include_image_descriptions || options.includeImageDescriptions,
          ),
          // Pass-through for freshness where supported
          timeRange: options.timeRange,
        });
        return normalizeResults(results, 'tavily');
      },
    },

    ddg: {
      search: async (query, options = {}) => {
        const results = await searchDDG(query, {
          max_results: options.max_results || options.maxResults || 10,
        });
        return normalizeResults(results, 'ddg');
      },
    },

    readWebPage: async (url, options = {}) => {
      return readWebPageWithFallback(url, {
        hint: options.hint || '',
        timeout: options.timeout || 5000,
      });
    },
  };
}

/**
 * Normalize provider responses to consistent format
 */
function normalizeResults(rawResults, provider) {
  if (rawResults && !Array.isArray(rawResults) && Array.isArray(rawResults.results)) {
    rawResults = rawResults.results;
  }
  if (!Array.isArray(rawResults)) return [];

  return rawResults
    .map((result, index) => {
      const normalized = {
        url: '',
        title: '',
        snippet: '',
        score: 10 - index,
        provider,
        rank: index + 1,
      };

      if (provider === 'serper') {
        normalized.url = result.link || result.url || '';
        normalized.title = result.title || '';
        normalized.snippet = result.snippet || result.description || '';
      } else if (provider === 'tavily') {
        normalized.url = result.url || '';
        normalized.title = result.title || '';
        normalized.snippet = result.content || result.snippet || '';
        normalized.score = result.score || normalized.score;
      } else if (provider === 'ddg') {
        normalized.url = result.url || result.link || '';
        normalized.title = result.title || '';
        normalized.snippet = result.snippet || result.body || result.description || '';
      } else {
        normalized.url = result.url || result.link || '';
        normalized.title = result.title || '';
        normalized.snippet = result.snippet || result.description || result.content || '';
      }

      return normalized;
    })
    .filter((r) => r.url);
}

const _internal = { normalizeResults };

module.exports = {
  createProviders,
  _internal,
};
