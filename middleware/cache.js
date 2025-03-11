const ms = require('ms');

/**
 * Cache middleware for Express
 * @param {string|number} duration Cache duration as string (e.g., '5 minutes') or in ms
 */
function cache(duration) {
  const cacheTime = typeof duration === 'string' ? ms(duration) : duration;
  const cacheStore = new Map();

  return (req, res, next) => {
    // Skip cache for non-GET methods
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key from the URL
    const key = req.originalUrl;

    // Check if we have a cached response
    const cachedItem = cacheStore.get(key);
    if (cachedItem && cachedItem.expiry > Date.now()) {
      // Send cached response
      res.set('X-Cache', 'HIT');
      res.set('Content-Type', cachedItem.contentType);
      return res.send(cachedItem.body);
    }

    // Cache miss - capture the response
    const originalSend = res.send;
    res.send = function(body) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheStore.set(key, {
          body,
          contentType: res.get('Content-Type'),
          expiry: Date.now() + cacheTime
        });
      }
      
      res.set('X-Cache', 'MISS');
      return originalSend.call(this, body);
    };

    next();
  };
}

module.exports = cache;
