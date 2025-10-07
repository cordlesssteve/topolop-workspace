/**
 * Performance Optimization Utilities for Topolop Analyzers
 * 
 * Provides utilities for optimizing analysis performance including
 * parallel processing, batching, and resource management.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const { resolveConfig } = require('../config/default-config');

/**
 * Batch processor for handling multiple analysis tasks
 */
class BatchProcessor {
  constructor(options = {}) {
    this.concurrency = options.concurrency || Math.min(4, require('os').cpus().length);
    this.batchSize = options.batchSize || 10;
    this.activeWorkers = 0;
    this.queue = [];
  }

  /**
   * Process items in parallel batches
   */
  async processBatch(items, processingFunction, options = {}) {
    const { 
      preserveOrder = true,
      onProgress = null,
      maxRetries = 2
    } = options;

    if (items.length === 0) {
      return [];
    }

    // Create batches
    const batches = this._createBatches(items);
    const results = new Array(items.length);
    const promises = [];

    let completed = 0;

    // Process batches with limited concurrency
    for (let i = 0; i < batches.length; i++) {
      const batchPromise = this._processSingleBatch(
        batches[i],
        processingFunction,
        maxRetries
      ).then(batchResults => {
        // Place results in correct positions if order preservation is needed
        if (preserveOrder) {
          batchResults.forEach((result, index) => {
            const globalIndex = i * this.batchSize + index;
            results[globalIndex] = result;
          });
        } else {
          return batchResults;
        }

        completed += batchResults.length;
        if (onProgress) {
          onProgress(completed, items.length);
        }

        return batchResults;
      });

      promises.push(batchPromise);

      // Limit concurrency
      if (promises.length >= this.concurrency) {
        await Promise.race(promises);
        // Remove completed promises
        for (let j = promises.length - 1; j >= 0; j--) {
          if (promises[j].isResolved) {
            promises.splice(j, 1);
          }
        }
      }
    }

    // Wait for all remaining promises
    await Promise.all(promises);

    return preserveOrder ? results : results.flat();
  }

  async _processSingleBatch(batch, processingFunction, maxRetries) {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        return await Promise.all(batch.map(processingFunction));
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          // Return error objects for failed items
          return batch.map(() => ({ error: error.message }));
        }
        // Wait before retry
        await this._sleep(Math.pow(2, attempt) * 100);
      }
    }
  }

  _createBatches(items) {
    const batches = [];
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }
    return batches;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Resource monitor for tracking system resources
 */
class ResourceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.memoryBaseline = process.memoryUsage();
    this.metrics = {
      cpuTime: 0,
      memoryPeak: 0,
      operationsCount: 0
    };
  }

  /**
   * Record an operation for performance tracking
   */
  recordOperation(operationType, duration, memoryUsed = 0) {
    this.metrics.cpuTime += duration;
    this.metrics.memoryPeak = Math.max(this.metrics.memoryPeak, memoryUsed);
    this.metrics.operationsCount++;

    // Log performance warnings
    if (duration > 10000) { // >10 seconds
      console.warn(`Slow operation: ${operationType} took ${duration}ms`);
    }

    const currentMemory = process.memoryUsage();
    const memoryIncrease = currentMemory.heapUsed - this.memoryBaseline.heapUsed;
    if (memoryIncrease > 100 * 1024 * 1024) { // >100MB increase
      console.warn(`High memory usage: ${operationType} used ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const totalTime = Date.now() - this.startTime;
    const currentMemory = process.memoryUsage();

    return {
      totalExecutionTime: totalTime,
      totalCpuTime: this.metrics.cpuTime,
      operationsCount: this.metrics.operationsCount,
      averageOperationTime: this.metrics.operationsCount > 0 
        ? Math.round(this.metrics.cpuTime / this.metrics.operationsCount)
        : 0,
      memoryPeak: this.metrics.memoryPeak,
      memoryIncrease: currentMemory.heapUsed - this.memoryBaseline.heapUsed,
      memoryEfficiency: this.metrics.operationsCount > 0
        ? Math.round((currentMemory.heapUsed - this.memoryBaseline.heapUsed) / this.metrics.operationsCount)
        : 0
    };
  }
}

/**
 * Debounced function executor
 */
class Debouncer {
  constructor(delay = 1000) {
    this.delay = delay;
    this.timeouts = new Map();
  }

  /**
   * Execute function after delay, canceling previous calls
   */
  debounce(key, fn, customDelay = null) {
    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const delay = customDelay || this.delay;
    const timeout = setTimeout(() => {
      this.timeouts.delete(key);
      fn();
    }, delay);

    this.timeouts.set(key, timeout);
  }

  /**
   * Cancel all pending executions
   */
  cancelAll() {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
}

/**
 * Throttled function executor
 */
class Throttler {
  constructor(interval = 1000) {
    this.interval = interval;
    this.lastExecutions = new Map();
  }

  /**
   * Execute function at most once per interval
   */
  throttle(key, fn) {
    const lastExecution = this.lastExecutions.get(key) || 0;
    const now = Date.now();

    if (now - lastExecution >= this.interval) {
      this.lastExecutions.set(key, now);
      return fn();
    }

    return Promise.resolve(null);
  }
}

/**
 * Performance timing decorator
 */
function timed(target, propertyName, descriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await method.apply(this, args);
      
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      if (resolveConfig('logging.enablePerformanceLogs')) {
        console.log(`⏱️  ${target.constructor.name}.${propertyName}: ${duration}ms (${Math.round(memoryUsed / 1024)}KB)`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${target.constructor.name}.${propertyName} failed after ${duration}ms:`, error.message);
      throw error;
    }
  };

  return descriptor;
}

/**
 * Memory usage tracker
 */
function trackMemoryUsage(operationName, threshold = 50 * 1024 * 1024) {
  const startMemory = process.memoryUsage();
  
  return {
    end: () => {
      const endMemory = process.memoryUsage();
      const used = endMemory.heapUsed - startMemory.heapUsed;
      
      if (used > threshold) {
        console.warn(`🚨 High memory usage in ${operationName}: ${Math.round(used / 1024 / 1024)}MB`);
      }

      return {
        used,
        usedMB: Math.round(used / 1024 / 1024),
        startMemory,
        endMemory
      };
    }
  };
}

/**
 * Async operation with timeout
 */
function withTimeout(promise, timeoutMs, operationName = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 5000,
    retryCondition = () => true
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !retryCondition(error)) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

module.exports = {
  BatchProcessor,
  ResourceMonitor,
  Debouncer,
  Throttler,
  timed,
  trackMemoryUsage,
  withTimeout,
  withRetry
};