// src/utils/sseManager.js - Enhanced SSE with batching and connection management
'use strict';

const logger = require('./logger');

/**
 * SSE Batcher - batches tokens for improved performance
 */
class SSEBatcher {
  constructor(res, options = {}) {
    this.res = res;
    this.buffer = [];
    this.batchSize = options.batchSize || 10; // tokens per batch
    this.flushInterval = options.flushInterval || 16; // ~60fps
    this.timer = null;
    this.closed = false;
  }
  
  /**
   * Write token to buffer
   */
  write(token) {
    if (this.closed) return false;
    
    this.buffer.push(token);
    
    // Flush if buffer full
    if (this.buffer.length >= this.batchSize) {
      return this.flush();
    }
    
    // Schedule flush
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
    
    return true;
  }
  
  /**
   * Flush buffer to client
   */
  flush() {
    if (this.closed || this.buffer.length === 0) return false;
    
    const batch = this.buffer.join('');
    this.buffer = [];
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    try {
      this.res.write(`data: ${JSON.stringify({ token: batch })}\n\n`);
      return true;
    } catch (error) {
      logger.error('SSE write error', error);
      this.closed = true;
      return false;
    }
  }
  
  /**
   * Send event (non-batched)
   */
  sendEvent(event, data) {
    if (this.closed) return false;
    
    // Flush pending tokens first
    this.flush();
    
    try {
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (error) {
      logger.error('SSE sendEvent error', error);
      this.closed = true;
      return false;
    }
  }
  
  /**
   * Close connection
   */
  end() {
    if (this.closed) return;
    
    this.flush();
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    try {
      this.res.end();
    } catch (error) {
      // Already closed
    }
    
    this.closed = true;
  }
}

/**
 * SSE Connection Manager
 */
class SSEConnectionManager {
  constructor() {
    this.connections = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }
  
  /**
   * Add new SSE connection
   */
  addConnection(userId, conversationId, req, res) {
    const key = `${userId}:${conversationId}`;
    
    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });
    
    // Create batcher
    const batcher = new SSEBatcher(res, {
      batchSize: 10,
      flushInterval: 16
    });
    
    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 15000); // Every 15s
    
    // Store connection
    this.connections.set(key, {
      res,
      batcher,
      heartbeat,
      userId,
      conversationId,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
    
    // Cleanup on close
    req.on('close', () => {
      this.removeConnection(key);
    });
    
    logger.debug('SSE connection added', { key, userId, conversationId });
    
    return { key, batcher };
  }
  
  /**
   * Get connection
   */
  getConnection(key) {
    return this.connections.get(key);
  }
  
  /**
   * Remove connection
   */
  removeConnection(key) {
    const conn = this.connections.get(key);
    if (!conn) return;
    
    clearInterval(conn.heartbeat);
    conn.batcher.end();
    this.connections.delete(key);
    
    const duration = Date.now() - conn.startTime;
    logger.debug('SSE connection removed', {
      key,
      duration_ms: duration,
      duration_sec: (duration / 1000).toFixed(2)
    });
  }
  
  /**
   * Send token to connection
   */
  sendToken(key, token) {
    const conn = this.connections.get(key);
    if (!conn) return false;
    
    conn.lastActivity = Date.now();
    return conn.batcher.write(token);
  }
  
  /**
   * Send event to connection
   */
  sendEvent(key, event, data) {
    const conn = this.connections.get(key);
    if (!conn) return false;
    
    conn.lastActivity = Date.now();
    return conn.batcher.sendEvent(event, data);
  }
  
  /**
   * Flush connection buffer
   */
  flush(key) {
    const conn = this.connections.get(key);
    if (conn) {
      conn.batcher.flush();
    }
  }
  
  /**
   * Close connection
   */
  close(key) {
    this.removeConnection(key);
  }
  
  /**
   * Start cleanup process
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
    
    // Don't prevent process exit
    this.cleanupInterval.unref();
  }
  
  /**
   * Cleanup stale connections
   */
  cleanup() {
    const now = Date.now();
    const timeout = 300000; // 5 minutes
    let cleaned = 0;
    
    for (const [key, conn] of this.connections.entries()) {
      if (now - conn.lastActivity > timeout) {
        this.removeConnection(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info('SSE cleanup completed', {
        removed: cleaned,
        active: this.connections.size
      });
    }
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const now = Date.now();
    const connections = Array.from(this.connections.values());
    
    return {
      total_active: connections.length,
      by_user: connections.reduce((acc, conn) => {
        acc[conn.userId] = (acc[conn.userId] || 0) + 1;
        return acc;
      }, {}),
      oldest_connection_age_sec: connections.length > 0
        ? Math.max(...connections.map(c => (now - c.startTime) / 1000))
        : 0
    };
  }
}

// Singleton instance
module.exports = new SSEConnectionManager();
