/**
 * Simple memory cache for API responses
 */
class Cache {
  constructor(ttl = 300000) { // Default TTL: 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Get item from cache
   * @param {string} key Cache key
   * @returns {*|null} Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set item in cache
   * @param {string} key Cache key
   * @param {*} value Value to cache
   * @param {number} ttl Custom TTL in milliseconds (optional)
   */
  set(key, value, ttl) {
    const expiry = Date.now() + (ttl || this.ttl);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Delete item from cache
   * @param {string} key Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }
}

module.exports = Cache;
