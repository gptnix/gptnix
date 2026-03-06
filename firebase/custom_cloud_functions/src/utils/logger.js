// src/utils/logger.js - Structured logging for production
'use strict';

class Logger {
  constructor(serviceName = 'gptnix-backend') {
    this.serviceName = serviceName;
    this.environment = process.env.NODE_ENV || 'development';
  }
  
  /**
   * Create structured log entry
   */
  createLogEntry(level, message, meta = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      pid: process.pid,
      message,
      ...meta
    };
  }
  
  /**
   * Write log to stdout (Cloud Logging will pick this up)
   */
  write(logEntry) {
    console.log(JSON.stringify(logEntry));
  }
  
  /**
   * Info level logging
   */
  info(message, meta = {}) {
    this.write(this.createLogEntry('info', message, meta));
  }
  
  /**
   * Warning level logging
   */
  warn(message, meta = {}) {
    this.write(this.createLogEntry('warn', message, meta));
  }
  
  /**
   * Error level logging
   */
  error(message, error, meta = {}) {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      }
    } : {};
    
    this.write(this.createLogEntry('error', message, {
      ...errorMeta,
      ...meta
    }));
  }
  
  /**
   * Debug level logging (only in development)
   */
  debug(message, meta = {}) {
    if (this.environment === 'development') {
      this.write(this.createLogEntry('debug', message, meta));
    }
  }
  
  /**
   * Log HTTP request
   */
  logRequest(req, res, duration) {
    this.info('http_request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.uid,
      request_id: req.id,
      user_agent: req.get('user-agent')
    });
  }
  
  /**
   * Log AI provider call
   */
  logAICall(provider, model, tokens, cost, duration) {
    this.info('ai_provider_call', {
      provider,
      model,
      tokens,
      cost,
      duration_ms: duration
    });
  }
  
  /**
   * Log tool execution
   */
  logToolExecution(tool, success, duration, error = null) {
    this[success ? 'info' : 'error']('tool_execution', {
      tool,
      success,
      duration_ms: duration,
      error: error ? error.message : undefined
    });
  }
}

// Singleton instance
module.exports = new Logger();
