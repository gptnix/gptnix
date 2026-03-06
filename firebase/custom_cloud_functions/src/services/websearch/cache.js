'use strict';

/**
 * Tiny in-memory TTL cache. Cloud Run instances are ephemeral, but this still
 * cuts costs/latency for repeated queries during the same warm instance.
 */

class TtlCache {
  constructor({ ttlMs = 15 * 60 * 1000, maxEntries = 250 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  _now() {
    return Date.now();
  }

  get(key) {
    const item = this.map.get(key);
    if (!item) return null;

    if (this._now() > item.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // refresh LRU-ish
    this.map.delete(key);
    this.map.set(key, item);

    return item.value;
  }

  set(key, value) {
    // evict oldest
    while (this.map.size >= this.maxEntries) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }

    this.map.set(key, { value, expiresAt: this._now() + this.ttlMs });
  }

  size() {
    return this.map.size;
  }
}

module.exports = { TtlCache };
