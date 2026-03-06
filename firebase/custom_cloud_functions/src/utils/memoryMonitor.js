// src/utils/memoryMonitor.js - Memory monitoring and leak detection
'use strict';

class MemoryMonitor {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.85; // 85% threshold
    this.checkInterval = options.checkInterval || 30000; // 30s
    this.alertInterval = options.alertInterval || 300000; // 5 min between alerts
    this.interval = null;
    this.lastAlert = 0;
    this.measurements = [];
    this.maxMeasurements = 10;
  }
  
  start() {
    if (this.interval) return;
    
    console.log(`📊 Memory monitor started (threshold: ${(this.threshold * 100).toFixed(0)}%)`);
    
    this.interval = setInterval(() => {
      this.check();
    }, this.checkInterval);
    
    // Don't prevent process exit
    this.interval.unref();
  }
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('📊 Memory monitor stopped');
    }
  }
  
  check() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const heapTotal = usage.heapTotal;
    const rss = usage.rss;
    const external = usage.external;
    const percentage = heapUsed / heapTotal;
    
    // Store measurement
    this.measurements.push({
      timestamp: Date.now(),
      heapUsed,
      heapTotal,
      rss,
      percentage
    });
    
    // Keep only last N measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
    
    // Log current usage (sampling - not every time)
    if (Math.random() < 0.1) { // 10% of checks
      console.log(JSON.stringify({
        type: 'memory_sample',
        heap_used_mb: (heapUsed / 1024 / 1024).toFixed(2),
        heap_total_mb: (heapTotal / 1024 / 1024).toFixed(2),
        rss_mb: (rss / 1024 / 1024).toFixed(2),
        external_mb: (external / 1024 / 1024).toFixed(2),
        percentage: `${(percentage * 100).toFixed(2)}%`
      }));
    }
    
    // Check for high usage
    if (percentage > this.threshold) {
      this.handleHighMemory(percentage, heapUsed, heapTotal);
    }
  }
  
  handleHighMemory(percentage, heapUsed, heapTotal) {
    const now = Date.now();
    
    // Rate limit alerts
    if (now - this.lastAlert < this.alertInterval) {
      return;
    }
    
    this.lastAlert = now;
    
    console.warn(JSON.stringify({
      type: 'memory_warning',
      level: 'high',
      heap_used_mb: (heapUsed / 1024 / 1024).toFixed(2),
      heap_total_mb: (heapTotal / 1024 / 1024).toFixed(2),
      percentage: `${(percentage * 100).toFixed(2)}%`,
      message: 'High memory usage detected'
    }));
    
    // Trigger garbage collection if available
    if (global.gc) {
      console.log('🧹 Running garbage collection...');
      global.gc();
      
      // Check again after GC
      setTimeout(() => {
        const afterGC = process.memoryUsage();
        const newPercentage = afterGC.heapUsed / afterGC.heapTotal;
        
        console.log(JSON.stringify({
          type: 'memory_gc_result',
          before_mb: (heapUsed / 1024 / 1024).toFixed(2),
          after_mb: (afterGC.heapUsed / 1024 / 1024).toFixed(2),
          freed_mb: ((heapUsed - afterGC.heapUsed) / 1024 / 1024).toFixed(2),
          new_percentage: `${(newPercentage * 100).toFixed(2)}%`
        }));
      }, 100);
    } else {
      console.log('ℹ️  To enable manual GC, start with: node --expose-gc index.js');
    }
  }
  
  getStats() {
    if (this.measurements.length === 0) {
      return null;
    }
    
    const latest = this.measurements[this.measurements.length - 1];
    const avg = this.measurements.reduce((sum, m) => sum + m.percentage, 0) / this.measurements.length;
    const max = Math.max(...this.measurements.map(m => m.percentage));
    
    return {
      current: {
        heap_used_mb: (latest.heapUsed / 1024 / 1024).toFixed(2),
        heap_total_mb: (latest.heapTotal / 1024 / 1024).toFixed(2),
        rss_mb: (latest.rss / 1024 / 1024).toFixed(2),
        percentage: `${(latest.percentage * 100).toFixed(2)}%`
      },
      stats: {
        avg_percentage: `${(avg * 100).toFixed(2)}%`,
        max_percentage: `${(max * 100).toFixed(2)}%`,
        samples: this.measurements.length
      }
    };
  }
}

module.exports = MemoryMonitor;
