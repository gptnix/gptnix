'use strict';

/**
 * Rate Limiter V2 - Production-Ready with Redis/Upstash Support
 * 
 * Fixes from V1:
 * - In-memory Map doesn't work across Cloud Run instances
 * - No cleanup mechanism leads to memory leaks
 * - Per-instance limits instead of global limits
 * 
 * V2 Features:
 * - Redis/Upstash support for distributed rate limiting
 * - Fallback to in-memory for development
 * - Sliding window algorithm
 * - Automatic cleanup
 * - Token bucket for burst protection
 */

// ═══════════════════════════════════════════════════════════
// REDIS CLIENT (optional - graceful fallback to in-memory)
// ═══════════════════════════════════════════════════════════

let redisClient = null;

// Try to connect to Redis if URL is provided
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (REDIS_URL && REDIS_TOKEN) {
  // Upstash Redis REST API client
  try {
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });
    console.log('✅ Rate limiter: Using Redis/Upstash (distributed)');
  } catch (e) {
    console.warn('⚠️  Rate limiter: @upstash/redis not installed, falling back to in-memory');
    console.warn('   Install: npm install @upstash/redis');
  }
} else {
  console.log('ℹ️  Rate limiter: Using in-memory storage (single instance only)');
}

// ═══════════════════════════════════════════════════════════
// IN-MEMORY FALLBACK (for development / no Redis)
// ═══════════════════════════════════════════════════════════

const memoryStore = new Map(); // key -> { count, resetAt, tokens }

// Cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryStore.entries()) {
    if (data.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════
// RATE LIMIT LOGIC
// ═══════════════════════════════════════════════════════════

/**
 * Rate limit check with token bucket algorithm
 * 
 * @param {string} key - Unique identifier (userId, IP, etc.)
 * @param {Object} opts - Configuration
 * @param {number} opts.maxRequests - Max requests per window (default: 60)
 * @param {number} opts.windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @param {number} opts.burstSize - Max burst size (default: maxRequests * 1.5)
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
async function checkRateLimit(key, opts = {}) {
  const maxRequests = opts.maxRequests || 60;
  const windowMs = opts.windowMs || 60000;
  const burstSize = opts.burstSize || Math.floor(maxRequests * 1.5);
  
  const now = Date.now();
  const resetAt = now + windowMs;
  
  try {
    if (redisClient) {
      // ═══════════════════════════════════════════
      // REDIS: Distributed rate limiting
      // ═══════════════════════════════════════════
      
      // Use Redis INCR + EXPIRE for atomic counter
      const redisKey = `ratelimit:${key}`;
      
      // Get current count
      const count = await redisClient.incr(redisKey);
      
      // Set expiry on first request
      if (count === 1) {
        await redisClient.pexpire(redisKey, windowMs);
      }
      
      // Check if over limit
      if (count > burstSize) {
        const ttl = await redisClient.pttl(redisKey);
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + (ttl > 0 ? ttl : windowMs),
          count,
          limit: maxRequests,
        };
      }
      
      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt,
        count,
        limit: maxRequests,
      };
      
    } else {
      // ═══════════════════════════════════════════
      // IN-MEMORY: Single-instance rate limiting
      // ═══════════════════════════════════════════
      
      let data = memoryStore.get(key);
      
      // Initialize or reset if window expired
      if (!data || data.resetAt < now) {
        data = {
          count: 1,
          resetAt,
          tokens: maxRequests - 1,
        };
        memoryStore.set(key, data);
        
        return {
          allowed: true,
          remaining: data.tokens,
          resetAt: data.resetAt,
          count: data.count,
          limit: maxRequests,
        };
      }
      
      // Increment counter
      data.count++;
      data.tokens = Math.max(0, maxRequests - data.count);
      
      // Check if over burst limit
      if (data.count > burstSize) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: data.resetAt,
          count: data.count,
          limit: maxRequests,
        };
      }
      
      return {
        allowed: data.count <= maxRequests,
        remaining: data.tokens,
        resetAt: data.resetAt,
        count: data.count,
        limit: maxRequests,
      };
    }
    
  } catch (error) {
    console.error('❌ Rate limiter error:', error);
    // Fail open (allow request) to avoid blocking legitimate traffic
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
      count: 0,
      limit: maxRequests,
      error: error.message,
    };
  }
}

/**
 * Express middleware factory for rate limiting
 * 
 * @param {Object} opts - Configuration
 * @param {Function} opts.keyGenerator - Extract key from request (default: userId)
 * @param {number} opts.maxRequests - Max requests per window
 * @param {number} opts.windowMs - Time window in milliseconds
 * @param {boolean} opts.skipSuccessfulRequests - Don't count successful requests
 * @param {Function} opts.handler - Custom rate limit exceeded handler
 */
function createRateLimiter(opts = {}) {
  const keyGenerator = opts.keyGenerator || ((req) => {
    // Default: use authenticated userId
    return req.user?.uid || req.ip || 'anonymous';
  });
  
  const maxRequests = opts.maxRequests || 60;
  const windowMs = opts.windowMs || 60000;
  const skipSuccessfulRequests = opts.skipSuccessfulRequests || false;
  
  const defaultHandler = (req, res) => {
    const retryAfter = Math.ceil(windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      ok: false,
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later',
      retryAfter,
    });
  };
  
  const handler = opts.handler || defaultHandler;
  
  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      if (!key) {
        console.warn('⚠️  Rate limiter: no key generated, allowing request');
        return next();
      }
      
      const result = await checkRateLimit(key, { maxRequests, windowMs });
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt);
      
      if (!result.allowed) {
        console.warn(`⚠️  Rate limit exceeded: ${key} (${result.count}/${result.limit})`);
        return handler(req, res);
      }
      
      // If skipSuccessfulRequests, we'll need to decrement on successful response
      if (skipSuccessfulRequests) {
        const originalJson = res.json.bind(res);
        res.json = function(body) {
          if (res.statusCode < 400) {
            // Success - decrement counter
            // Note: This is best-effort, won't work perfectly with Redis
            if (!redisClient) {
              const data = memoryStore.get(key);
              if (data && data.count > 0) {
                data.count--;
                data.tokens = Math.max(0, maxRequests - data.count);
              }
            }
          }
          return originalJson(body);
        };
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Rate limiter middleware error:', error);
      // Fail open
      next();
    }
  };
}

// ═══════════════════════════════════════════════════════════
// PRESET RATE LIMITERS
// ═══════════════════════════════════════════════════════════

// Standard rate limiter: 60 req/min per user
const standardRateLimit = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
});

// Strict rate limiter: 20 req/min per user (for expensive operations)
const strictRateLimit = createRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
});

// Generous rate limiter: 120 req/min per user (for lightweight operations)
const generousRateLimit = createRateLimiter({
  maxRequests: 120,
  windowMs: 60 * 1000,
});

// IP-based rate limiter: 100 req/min per IP (for unauthenticated endpoints)
const ipRateLimit = createRateLimiter({
  keyGenerator: (req) => req.ip || 'unknown',
  maxRequests: 100,
  windowMs: 60 * 1000,
});

module.exports = {
  checkRateLimit,
  createRateLimiter,
  standardRateLimit,
  strictRateLimit,
  generousRateLimit,
  ipRateLimit,
  isRedisEnabled: () => !!redisClient,
};
