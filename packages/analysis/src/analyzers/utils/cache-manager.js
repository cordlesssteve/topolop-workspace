/**
 * Cache Manager for Topolop Analyzers
 * 
 * Provides intelligent caching for expensive analysis operations
 * with TTL-based expiration and memory management.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { resolveConfig } = require('../config/default-config');
const { safeReadFile, safeWriteFile, ensureDirectory } = require('./fs-utils');

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    this.cleanupInterval = null;
    this.initialized = false;
  }

  /**
   * Initialize cache manager (called lazily)
   */
  _ensureInitialized() {
    if (this.initialized) return;
    
    // Start cleanup interval only when first used
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
    
    this.initialized = true;
  }

  /**
   * Generate cache key for analysis operation
   */
  generateKey(operation, codebasePath, options = {}) {
    const keyData = {
      operation,
      path: codebasePath,
      options: this._normalizeOptions(options),
      timestamp: this._getPathTimestamp(codebasePath)
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 32); // Extended to 32 chars to reduce collisions
  }

  /**
   * Get from cache (memory first, then disk)
   */
  async get(key, operation = 'unknown') {
    this._ensureInitialized();
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this._isExpired(memoryEntry)) {
      this.cacheStats.hits++;
      return memoryEntry.data;
    }

    // Check disk cache
    const diskPath = await this._getDiskCachePath(key);
    try {
      const cacheContent = await safeReadFile(diskPath);
      const cacheEntry = JSON.parse(cacheContent);
      
      if (!this._isExpired(cacheEntry)) {
        // Move to memory cache for faster access
        this._setMemoryCache(key, cacheEntry.data);
        this.cacheStats.hits++;
        return cacheEntry.data;
      } else {
        // Expired, remove from disk
        await this._removeDiskCache(key);
      }
    } catch (error) {
      // Not in disk cache or error reading
    }

    this.cacheStats.misses++;
    return null;
  }

  /**
   * Set cache entry (memory and optionally disk)
   */
  async set(key, data, options = {}) {
    this._ensureInitialized();
    
    const { 
      persistToDisk = true, 
      ttl = resolveConfig('cache.ttl'),
      operation = 'unknown'
    } = options;

    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      operation
    };

    // Set in memory cache
    this._setMemoryCache(key, data, entry);

    // Set in disk cache if requested
    if (persistToDisk) {
      await this._setDiskCache(key, entry);
    }
  }

  /**
   * Check if analysis should be cached
   */
  shouldCache(operation, codebasePath, resultSize = 0) {
    if (!resolveConfig('cache.enabled')) {
      return false;
    }

    // Don't cache very large results (>10MB)
    if (resultSize > 10 * 1024 * 1024) {
      return false;
    }

    // Don't cache operations on very large codebases
    const maxCacheableSize = 100 * 1024 * 1024; // 100MB
    try {
      const stats = require('fs').statSync(codebasePath);
      if (stats.size > maxCacheableSize) {
        return false;
      }
    } catch (error) {
      // If we can't stat, assume it's cacheable
    }

    // Cache expensive operations
    const cacheableOperations = [
      'ast-analysis',
      'formal-methods',
      'typescript-compile',
      'perf-analysis',
      'git-analysis'
    ];

    return cacheableOperations.includes(operation);
  }

  /**
   * Cached wrapper for analysis operations
   */
  async cached(key, operation, expensiveFunction, options = {}) {
    // Try to get from cache
    const cached = await this.get(key, operation);
    if (cached !== null) {
      return cached;
    }

    // Execute expensive operation
    const startTime = Date.now();
    const result = await expensiveFunction();
    const executionTime = Date.now() - startTime;

    // Cache if operation took significant time or should be cached
    if (executionTime > 1000 || this.shouldCache(operation)) {
      const resultSize = JSON.stringify(result).length;
      if (this.shouldCache(operation, options.codebasePath, resultSize)) {
        await this.set(key, result, {
          ...options,
          operation
        });
      }
    }

    return result;
  }

  /**
   * Invalidate cache entries for a specific path
   */
  async invalidate(codebasePath) {
    const keysToRemove = [];
    
    // Check memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.metadata?.path === codebasePath) {
        keysToRemove.push(key);
      }
    }

    // Remove from memory
    keysToRemove.forEach(key => this.memoryCache.delete(key));

    // Implement disk cache invalidation by path
    await this._invalidateDiskCacheByPath(codebasePath);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0 
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      memoryEntries: this.memoryCache.size
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (this._isExpired(entry, now)) {
        this.memoryCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.cacheStats.evictions += removed;
    }
  }

  /**
   * Clear all caches
   */
  async clear() {
    this.memoryCache.clear();
    
    // Clear disk cache
    try {
      const cacheDir = await this._getCacheDir();
      const files = await fs.readdir(cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.cache.json')) {
          await fs.unlink(path.join(cacheDir, file));
        }
      }
    } catch (error) {
      // Cache directory might not exist yet
    }

    // Reset stats
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Shutdown cache manager
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Private methods

  _normalizeOptions(options) {
    // Create a normalized version of options for consistent hashing
    const normalized = { ...options };
    delete normalized.timestamp;
    delete normalized.cacheKey;
    return normalized;
  }

  _getPathTimestamp(codebasePath) {
    try {
      // Handle different path types safely
      if (!codebasePath || typeof codebasePath !== 'string') {
        return Date.now();
      }
      
      const fs = require('fs');
      const stats = fs.statSync(codebasePath);
      return stats.mtime.getTime();
    } catch (error) {
      // Path might not exist or be inaccessible
      return Date.now();
    }
  }

  _isExpired(entry, now = Date.now()) {
    return now - entry.timestamp > entry.ttl;
  }

  _setMemoryCache(key, data, entry = null) {
    const maxEntries = resolveConfig('cache.maxEntries');
    
    // Evict LRU entries if at capacity
    if (this.memoryCache.size >= maxEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
      this.cacheStats.evictions++;
    }

    this.memoryCache.set(key, entry || {
      data,
      timestamp: Date.now(),
      ttl: resolveConfig('cache.ttl')
    });
  }

  async _getDiskCachePath(key) {
    const cacheDir = await this._getCacheDir();
    return path.join(cacheDir, `${key}.cache.json`);
  }

  async _getCacheDir() {
    const configuredDir = resolveConfig('paths.cacheDir');
    const cacheDir = configuredDir || path.join(os.tmpdir(), 'topolop-cache');
    await ensureDirectory(cacheDir);
    return cacheDir;
  }

  async _setDiskCache(key, entry) {
    try {
      const diskPath = await this._getDiskCachePath(key);
      await safeWriteFile(diskPath, JSON.stringify(entry));
    } catch (error) {
      console.warn(`Warning: Could not write to disk cache: ${error.message}`);
    }
  }

  async _removeDiskCache(key) {
    try {
      const diskPath = await this._getDiskCachePath(key);
      await fs.unlink(diskPath);
    } catch (error) {
      // File might not exist, that's okay
    }
  }

  async _invalidateDiskCacheByPath(codebasePath) {
    try {
      const cacheDir = await this._getCacheDir();
      const files = await fs.readdir(cacheDir);
      
      // Read each cache file and check if it matches the path
      for (const file of files) {
        if (file.endsWith('.cache.json')) {
          try {
            const filePath = path.join(cacheDir, file);
            const cacheContent = await safeReadFile(filePath);
            const cacheEntry = JSON.parse(cacheContent);
            
            // Check if this cache entry is for the given path
            if (this._cacheEntryMatchesPath(cacheEntry, codebasePath)) {
              await fs.unlink(filePath);
            }
          } catch (error) {
            // Skip files that can't be read or parsed
            console.warn(`Warning: Could not process cache file ${file}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not invalidate disk cache by path: ${error.message}`);
    }
  }

  _cacheEntryMatchesPath(cacheEntry, targetPath) {
    // Check if cache entry matches the target path
    if (cacheEntry.metadata && cacheEntry.metadata.path) {
      return cacheEntry.metadata.path === targetPath;
    }
    
    // Fallback: check if the operation name contains the path
    if (cacheEntry.operation) {
      return cacheEntry.operation.includes(targetPath);
    }
    
    return false;
  }
}

// Global cache manager instance
const globalCacheManager = new CacheManager();

// Cleanup on process exit
process.on('exit', () => {
  globalCacheManager.shutdown();
});

module.exports = {
  CacheManager,
  globalCacheManager
};