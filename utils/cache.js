const redisConfig = require('../config/redis');
const { logger } = require('./logger');

/**
 * Hybrid cache implementation with Redis fallback to memory
 * Automatically falls back to memory cache if Redis is unavailable
 */
class Cache {
  constructor(ttl = 300000) { // Default TTL: 5 minutes
    this.ttl = ttl;
    this.memoryCache = new Map(); // Fallback memory cache
    this.redis = null;
    this.useRedis = false;
    this.initPromise = null;
    
    // Start Redis initialization but don't wait for it
    this.initPromise = this._initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  async _initializeRedis() {
    try {
      // Give Redis time to connect (it's initialized in bankapi.js)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.redis = redisConfig.getClient();
      if (this.redis && redisConfig.isRedisConnected()) {
        this.useRedis = true;
        logger.info('Cache: Using Redis for caching');
      } else {
        logger.info('Cache: Using memory cache (Redis not available)');
      }
    } catch (error) {
      logger.warn('Cache: Failed to initialize Redis, using memory cache:', error.message);
      this.useRedis = false;
    }
  }

  /**
   * Ensure Redis is initialized before operations
   */
  async _ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null; // Only initialize once
    }
  }

  /**
   * Check and update Redis availability
   */
  _checkRedisAvailability() {
    this.useRedis = this.redis && redisConfig.isRedisConnected();
  }

  /**
   * Get item from cache (Redis first, then memory fallback)
   * @param {string} key Cache key
   * @returns {*|null} Cached value or null if not found/expired
   */
  async get(key) {
    await this._ensureInitialized();
    this._checkRedisAvailability();

    if (this.useRedis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        logger.warn('Cache: Redis get failed, falling back to memory:', error.message);
        this.useRedis = false;
      }
    }

    // Fallback to memory cache
    const item = this.memoryCache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (item.expiry < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set item in cache (Redis and memory)
   * @param {string} key Cache key
   * @param {*} value Value to cache
   * @param {number} ttl Custom TTL in milliseconds (optional)
   */
  async set(key, value, ttl) {
    await this._ensureInitialized();
    const cacheTtl = ttl || this.ttl;
    this._checkRedisAvailability();

    if (this.useRedis) {
      try {
        await this.redis.setex(key, Math.ceil(cacheTtl / 1000), JSON.stringify(value));
      } catch (error) {
        logger.warn('Cache: Redis set failed, using memory only:', error.message);
        this.useRedis = false;
      }
    }

    // Always maintain memory cache as backup
    const expiry = Date.now() + cacheTtl;
    this.memoryCache.set(key, { value, expiry });
  }

  /**
   * Delete item from cache (Redis and memory)
   * @param {string} key Cache key
   */
  async delete(key) {
    await this._ensureInitialized();
    this._checkRedisAvailability();

    if (this.useRedis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.warn('Cache: Redis delete failed:', error.message);
      }
    }

    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache (Redis and memory)
   */
  async clear() {
    await this._ensureInitialized();
    this._checkRedisAvailability();

    if (this.useRedis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        logger.warn('Cache: Redis clear failed:', error.message);
      }
    }

    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    await this._ensureInitialized();
    this._checkRedisAvailability();
    
    const stats = {
      useRedis: this.useRedis,
      memorySize: this.memoryCache.size,
      redisConnected: redisConfig.isRedisConnected()
    };

    if (this.useRedis) {
      try {
        const info = await this.redis.info('memory');
        stats.redisMemory = info;
      } catch (error) {
        stats.redisError = error.message;
      }
    }

    return stats;
  }
}

module.exports = Cache;
