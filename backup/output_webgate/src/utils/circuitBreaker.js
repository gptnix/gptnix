// src/utils/circuitBreaker.js - Circuit breaker for resilient service calls
'use strict';

const logger = require('./logger');

/**
 * Circuit Breaker States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered
 */
const STATE = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = STATE.CLOSED;
    
    // Configuration
    this.failureThreshold = options.failureThreshold || 5; // failures before opening
    this.successThreshold = options.successThreshold || 2; // successes to close from half-open
    this.timeout = options.timeout || 60000; // time before attempting half-open (60s)
    this.monitoringWindow = options.monitoringWindow || 60000; // window to count failures (60s)
    
    // State tracking
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    this.consecutiveFailures = 0;
    
    // Statistics
    this.stats = {
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalRejected: 0
    };
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, fallback = null) {
    this.stats.totalCalls++;
    
    // Check if circuit is open
    if (this.state === STATE.OPEN) {
      const now = Date.now();
      
      if (now < this.nextAttempt) {
        // Circuit still open, reject immediately
        this.stats.totalRejected++;
        
        if (fallback) {
          logger.debug(`Circuit breaker ${this.name} OPEN - using fallback`);
          return fallback();
        }
        
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        error.circuitBreaker = this.name;
        error.state = this.state;
        throw error;
      }
      
      // Time to try half-open
      this.state = STATE.HALF_OPEN;
      this.successes = 0;
      logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Handle successful call
   */
  onSuccess() {
    this.consecutiveFailures = 0;
    this.stats.totalSuccesses++;
    
    if (this.state === STATE.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.successThreshold) {
        // Success threshold met, close circuit
        this.state = STATE.CLOSED;
        this.failures = 0;
        logger.info(`Circuit breaker ${this.name} CLOSED - service recovered`);
      }
    }
  }
  
  /**
   * Handle failed call
   */
  onFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.stats.totalFailures++;
    
    if (this.state === STATE.HALF_OPEN) {
      // Failed in half-open, go back to open
      this.openCircuit();
      return;
    }
    
    if (this.state === STATE.CLOSED) {
      // Count failures in monitoring window
      this.failures++;
      
      if (this.failures >= this.failureThreshold) {
        this.openCircuit();
      }
      
      // Reset failure count after monitoring window
      setTimeout(() => {
        this.failures = Math.max(0, this.failures - 1);
      }, this.monitoringWindow);
    }
  }
  
  /**
   * Open the circuit
   */
  openCircuit() {
    this.state = STATE.OPEN;
    this.nextAttempt = Date.now() + this.timeout;
    
    logger.warn(`Circuit breaker ${this.name} OPEN - too many failures`, {
      consecutive_failures: this.consecutiveFailures,
      total_failures: this.stats.totalFailures,
      next_attempt: new Date(this.nextAttempt).toISOString()
    });
  }
  
  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.state = STATE.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      nextAttempt: this.state === STATE.OPEN ? new Date(this.nextAttempt).toISOString() : null,
      stats: {
        total_calls: this.stats.totalCalls,
        total_successes: this.stats.totalSuccesses,
        total_failures: this.stats.totalFailures,
        total_rejected: this.stats.totalRejected,
        success_rate: this.stats.totalCalls > 0 
          ? ((this.stats.totalSuccesses / this.stats.totalCalls) * 100).toFixed(2) + '%'
          : 'N/A'
      }
    };
  }
}

/**
 * Circuit Breaker Manager - manages multiple breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }
  
  /**
   * Get or create circuit breaker
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name);
  }
  
  /**
   * Execute with circuit breaker
   */
  async execute(name, fn, options = {}) {
    const breaker = this.getBreaker(name, options);
    return breaker.execute(fn, options.fallback);
  }
  
  /**
   * Get status of all breakers
   */
  getAllStatuses() {
    const statuses = [];
    for (const [name, breaker] of this.breakers.entries()) {
      statuses.push(breaker.getStatus());
    }
    return statuses;
  }
  
  /**
   * Reset specific breaker
   */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }
  
  /**
   * Reset all breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Singleton instance
module.exports = new CircuitBreakerManager();
