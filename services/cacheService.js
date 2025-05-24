const Cache = require('../utils/cache');
const { logger } = require('../utils/logger');

/**
 * Cache service for common banking operations
 * Provides pre-configured cache instances for different data types with Redis support
 */
class CacheService {
  constructor() {
    // Different cache instances for different data types with appropriate TTLs
    this.userCache = new Cache(15 * 60 * 1000);        // 15 minutes - user data
    this.accountCache = new Cache(10 * 60 * 1000);     // 10 minutes - account data
    this.exchangeRateCache = new Cache(5 * 60 * 1000); // 5 minutes - exchange rates
    this.settingsCache = new Cache(30 * 60 * 1000);    // 30 minutes - settings
    this.generalCache = new Cache(5 * 60 * 1000);      // 5 minutes - general purpose
  }

  /**
   * Cache user data
   */
  async cacheUser(userId, userData) {
    const key = `user:${userId}`;
    await this.userCache.set(key, userData);
    logger.debug(`Cached user data for user ${userId}`);
  }

  /**
   * Get cached user data
   */
  async getUser(userId) {
    const key = `user:${userId}`;
    return await this.userCache.get(key);
  }

  /**
   * Invalidate user cache
   */
  async invalidateUser(userId) {
    const key = `user:${userId}`;
    await this.userCache.delete(key);
    logger.debug(`Invalidated user cache for user ${userId}`);
  }

  /**
   * Cache account data
   */
  async cacheAccount(accountId, accountData) {
    const key = `account:${accountId}`;
    await this.accountCache.set(key, accountData);
    logger.debug(`Cached account data for account ${accountId}`);
  }

  /**
   * Get cached account data
   */
  async getAccount(accountId) {
    const key = `account:${accountId}`;
    return await this.accountCache.get(key);
  }

  /**
   * Invalidate account cache
   */
  async invalidateAccount(accountId) {
    const key = `account:${accountId}`;
    await this.accountCache.delete(key);
    logger.debug(`Invalidated account cache for account ${accountId}`);
  }

  /**
   * Cache user's accounts list
   */
  async cacheUserAccounts(userId, accountsData) {
    const key = `user_accounts:${userId}`;
    await this.accountCache.set(key, accountsData);
    logger.debug(`Cached accounts list for user ${userId}`);
  }

  /**
   * Get cached user's accounts list
   */
  async getUserAccounts(userId) {
    const key = `user_accounts:${userId}`;
    return await this.accountCache.get(key);
  }

  /**
   * Invalidate user's accounts cache
   */
  async invalidateUserAccounts(userId) {
    const key = `user_accounts:${userId}`;
    await this.accountCache.delete(key);
    logger.debug(`Invalidated accounts cache for user ${userId}`);
  }

  /**
   * Cache exchange rates
   */
  async cacheExchangeRate(baseCurrency, targetCurrency, rate) {
    const key = `exchange_rate:${baseCurrency}:${targetCurrency}`;
    await this.exchangeRateCache.set(key, rate);
    logger.debug(`Cached exchange rate ${baseCurrency}/${targetCurrency}: ${rate}`);
  }

  /**
   * Get cached exchange rate
   */
  async getExchangeRate(baseCurrency, targetCurrency) {
    const key = `exchange_rate:${baseCurrency}:${targetCurrency}`;
    return await this.exchangeRateCache.get(key);
  }

  /**
   * Cache application settings
   */
  async cacheSetting(settingName, settingValue) {
    const key = `setting:${settingName}`;
    await this.settingsCache.set(key, settingValue);
    logger.debug(`Cached setting ${settingName}`);
  }

  /**
   * Get cached setting
   */
  async getSetting(settingName) {
    const key = `setting:${settingName}`;
    return await this.settingsCache.get(key);
  }

  /**
   * Invalidate setting cache
   */
  async invalidateSetting(settingName) {
    const key = `setting:${settingName}`;
    await this.settingsCache.delete(key);
    logger.debug(`Invalidated setting cache for ${settingName}`);
  }

  /**
   * Cache fraud detection limits
   */
  async cacheFraudLimit(userId, limitType, limitData) {
    const key = `fraud_limit:${userId}:${limitType}`;
    await this.generalCache.set(key, limitData, 60 * 60 * 1000); // 1 hour TTL
    logger.debug(`Cached fraud limit for user ${userId}, type ${limitType}`);
  }

  /**
   * Get cached fraud limit
   */
  async getFraudLimit(userId, limitType) {
    const key = `fraud_limit:${userId}:${limitType}`;
    return await this.generalCache.get(key);
  }

  /**
   * Clear all caches (useful for maintenance)
   */
  async clearAll() {
    await Promise.all([
      this.userCache.clear(),
      this.accountCache.clear(),
      this.exchangeRateCache.clear(),
      this.settingsCache.clear(),
      this.generalCache.clear()
    ]);
    logger.info('Cleared all caches');
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const [userStats, accountStats, exchangeStats, settingsStats, generalStats] = await Promise.all([
      this.userCache.getStats(),
      this.accountCache.getStats(),
      this.exchangeRateCache.getStats(),
      this.settingsCache.getStats(),
      this.generalCache.getStats()
    ]);

    return {
      user: userStats,
      account: accountStats,
      exchangeRate: exchangeStats,
      settings: settingsStats,
      general: generalStats
    };
  }

  /**
   * Warm up frequently accessed data
   */
  async warmUp() {
    try {
      logger.info('Warming up cache with frequently accessed data...');
      
      // Cache common settings if available
      if (process.env.USE_DATABASE === 'true') {
        try {
          const { Setting } = require('../models');
          const settings = await Setting.findAll();
          
          for (const setting of settings) {
            await this.cacheSetting(setting.name, setting.value);
          }
          logger.info(`Warmed up ${settings.length} settings in cache`);
        } catch (error) {
          logger.warn('Could not warm up settings cache:', error.message);
        }
      }

      logger.info('Cache warm-up completed');
    } catch (error) {
      logger.error('Cache warm-up failed:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
