const Redis = require('ioredis');
const { logger } = require('../utils/logger');

/**
 * Redis configuration and connection management
 */
class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      this.client = new Redis(redisConfig);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis: Connected to Redis server');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis: Connection ready');
      });

      this.client.on('error', (error) => {
        logger.error('Redis connection error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis: Connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis: Reconnecting...');
      });

      // Test the connection
      await this.client.connect();
      await this.client.ping();
      
      logger.info('Redis: Successfully connected and tested');
      return this.client;

    } catch (error) {
      logger.error('Redis: Failed to connect:', error);
      // Fallback to memory cache if Redis is not available
      this.client = null;
      this.isConnected = false;
      return null;
    }
  }

  /**
   * Get Redis client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis: Disconnected gracefully');
      } catch (error) {
        logger.error('Redis: Error during disconnect:', error);
      }
    }
  }

  /**
   * Health check for Redis
   */
  async healthCheck() {
    if (!this.isRedisConnected()) {
      return {
        status: 'unhealthy',
        message: 'Redis not connected'
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connected: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

// Create singleton instance
const redisConfig = new RedisConfig();

module.exports = redisConfig;
