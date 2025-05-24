const ms = require('ms');
const redisConfig = require('../config/redis');
const { logger } = require('../utils/logger');

/**
 * Redis-backed cache middleware for Express with memory fallback
 * @param {string|number} duration Cache duration as string (e.g., '5 minutes') or in ms
 */
function cache(duration) {
  const cacheTime = typeof duration === 'string' ? ms(duration) : duration;
  const cacheTimeSeconds = Math.ceil(cacheTime / 1000);
  
  // Memory cache fallback
  const memoryStore = new Map();

  return async (req, res, next) => {
    // Skip cache for non-GET methods
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key from the URL and user context
    const key = `http_cache:${req.originalUrl}:${req.user?.id || 'anonymous'}`;

    try {
      // Try Redis first
      const redis = redisConfig.getClient();
      let cachedItem = null;

      if (redis && redisConfig.isRedisConnected()) {
        try {
          const redisValue = await redis.get(key);
          if (redisValue) {
            cachedItem = JSON.parse(redisValue);
          }
        } catch (redisError) {
          logger.warn('Cache middleware: Redis get failed, trying memory:', redisError.message);
        }
      }

      // Fallback to memory cache if Redis failed
      if (!cachedItem) {
        const memoryItem = memoryStore.get(key);
        if (memoryItem && memoryItem.expiry > Date.now()) {
          cachedItem = memoryItem;
        }
      }

      // Return cached response if found
      if (cachedItem) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Source', cachedItem.source || 'redis');
        res.set('Content-Type', cachedItem.contentType);
        return res.send(cachedItem.body);
      }

      // Cache miss - capture the response
      const originalSend = res.send;
      res.send = function(body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            body,
            contentType: res.get('Content-Type'),
            timestamp: Date.now(),
            source: 'redis'
          };

          // Try to store in Redis
          if (redis && redisConfig.isRedisConnected()) {
            redis.setex(key, cacheTimeSeconds, JSON.stringify(cacheData))
              .catch(error => {
                logger.warn('Cache middleware: Redis set failed:', error.message);
                // Store in memory as fallback
                memoryStore.set(key, {
                  ...cacheData,
                  expiry: Date.now() + cacheTime,
                  source: 'memory'
                });
              });
          } else {
            // Store in memory if Redis is not available
            memoryStore.set(key, {
              ...cacheData,
              expiry: Date.now() + cacheTime,
              source: 'memory'
            });
          }
        }
        
        res.set('X-Cache', 'MISS');
        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Continue without caching if there's an error
      next();
    }
  };
}

module.exports = cache;
