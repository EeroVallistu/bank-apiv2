const cacheService = require('./cacheService');
const { logger } = require('../utils/logger');

class CurrencyService {
  constructor() {
    this.supportedCurrencies = ['EUR', 'USD', 'GBP', 'SEK'];
    
    // Fallback static rates (in case API is unavailable)
    this.fallbackRates = {
      EUR: { USD: 1.09, GBP: 0.86, SEK: 11.21 },
      USD: { EUR: 0.92, GBP: 0.79, SEK: 10.28 },
      GBP: { EUR: 1.16, USD: 1.27, SEK: 13.02 },
      SEK: { EUR: 0.089, USD: 0.097, GBP: 0.077 }
    };
  }

  /**
   * Get current exchange rate from external API
   * @param {string} fromCurrency Base currency
   * @param {string} toCurrency Target currency
   * @returns {Promise<number>} Exchange rate
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // Return 1 if same currency
      if (fromCurrency === toCurrency) {
        return 1;
      }

      // Check Redis cache first
      const cachedRate = await cacheService.getExchangeRate(fromCurrency, toCurrency);
      if (cachedRate !== null) {
        logger.debug(`Exchange rate cache hit: ${fromCurrency}/${toCurrency} = ${cachedRate}`);
        return cachedRate;
      }

      // Fetch from external API
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
      );

      if (!response.ok) {
        throw new Error('Exchange rate API error');
      }

      const data = await response.json();
      const rate = data.rates[toCurrency];

      if (!rate) {
        throw new Error(`No rate found for ${fromCurrency} to ${toCurrency}`);
      }

      // Cache the rate in Redis
      await cacheService.cacheExchangeRate(fromCurrency, toCurrency, rate);
      logger.debug(`Cached exchange rate: ${fromCurrency}/${toCurrency} = ${rate}`);
      return rate;

    } catch (error) {
      logger.warn('Exchange rate API error, using fallback rates:', error.message);
      return this.getFallbackRate(fromCurrency, toCurrency);
    }
  }

  /**
   * Get fallback exchange rate from static rates
   */
  getFallbackRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1;
    
    return this.fallbackRates[fromCurrency]?.[toCurrency] 
      || 1 / this.fallbackRates[toCurrency][fromCurrency];
  }

  /**
   * Convert amount between currencies
   * @param {number} amount Amount to convert
   * @param {string} fromCurrency Source currency
   * @param {string} toCurrency Target currency
   * @returns {Promise<number>} Converted amount
   */
  async convert(amount, fromCurrency, toCurrency) {
    if (!this.supportedCurrencies.includes(fromCurrency) ||
        !this.supportedCurrencies.includes(toCurrency)) {
      throw new Error('Unsupported currency');
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return Number((amount * rate).toFixed(2));
  }
}

module.exports = new CurrencyService();
