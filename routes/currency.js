const express = require('express');
const { query, validationResult } = require('express-validator');
const router = express.Router();
const currencyService = require('../services/currencyService');
const cache = require('../middleware/cache');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /exchange-rates:
 *   get:
 *     summary: Get current exchange rates
 *     tags: [Currency]
 */
router.get('/exchange-rates', [
  query('base')
    .isIn(['EUR', 'USD', 'GBP', 'SEK'])
    .withMessage('Base currency must be EUR, USD, GBP, or SEK'),
  query('target')
    .optional()
    .isIn(['EUR', 'USD', 'GBP', 'SEK'])
    .withMessage('Target currency must be EUR, USD, GBP, or SEK')
], cache('5 minutes'), async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { base, target } = req.query;
    const rates = {};

    if (target) {
      // Get single exchange rate
      const rate = await currencyService.getExchangeRate(base, target);
      rates[target] = rate;
    } else {
      // Get all supported exchange rates
      const currencies = currencyService.supportedCurrencies.filter(c => c !== base);
      for (const currency of currencies) {
        rates[currency] = await currencyService.getExchangeRate(base, currency);
      }
    }

    res.json({
      base,
      rates
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({ error: 'Error fetching exchange rates' });
  }
});

module.exports = router;
