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
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: false, // Changed to false for immediate connection
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        // Add connection retry options
        retryStrategyOnFailure: (times) => Math.min(times * 50, 2000),
        enableReadyCheck: true,
        maxLoadingTimeout: 15000,
      };

      // Log connection attempt
      logger.info(`Redis: Attempting to connect to ${redisConfig.host}:${redisConfig.port}`);

      this.client = new Redis(redisConfig);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis: Connected to Redis server');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis: Connection ready');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        logger.error('Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis: Connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', (time) => {
        logger.info(`Redis: Reconnecting in ${time}ms...`);
      });

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis connection timeout'));
        }, 15000);

        this.client.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Test the connection with ping
      await this.client.ping();
      
      logger.info('Redis: Successfully connected and tested');
      return this.client;

    } catch (error) {
      logger.error('Redis: Failed to connect:', error.message);
      // Clean up client on failure
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
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
