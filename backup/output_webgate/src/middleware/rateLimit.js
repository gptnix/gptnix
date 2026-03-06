'use strict';

const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_REQUESTS = 50;

function isRateLimited(userId) {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];
  const recent = userRequests.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= RATE_LIMIT_REQUESTS) {
    return true;
  }

  recent.push(now);
  rateLimiter.set(userId, recent);
  return false;
}

module.exports = { isRateLimited };
