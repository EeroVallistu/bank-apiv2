const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const centralBankService = require('../services/centralBankService');

/**
 * @swagger
 * /bank-info:
 *   get:
 *     summary: Get bank information
 *     description: Returns bank prefix and other basic information
 *     tags: [Info]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bank information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: Example Bank
 *                 prefix:
 *                   type: string
 *                   example: 353
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    name: process.env.BANK_NAME,
    prefix: process.env.BANK_PREFIX
  });
});

/**
 * Debug endpoint to look up bank details
 * Only available in development mode
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/lookup/:prefix', authenticate, async (req, res) => {
    try {
      const bankPrefix = req.params.prefix;
      console.log(`Manual bank lookup request for prefix: ${bankPrefix}`);
      
      // Force refresh to get the latest data
      const bankDetails = await centralBankService.getBankDetails(bankPrefix, true);
      
      if (!bankDetails) {
        return res.status(404).json({
          status: 'error', 
          message: `No bank found with prefix ${bankPrefix}`
        });
      }
      
      res.json({
        status: 'success',
        data: bankDetails
      });
    } catch (error) {
      console.error('Error during manual bank lookup:', error);
      res.status(500).json({
        status: 'error',
        message: `Bank lookup failed: ${error.message}`
      });
    }
  });
  
  // Get all banks endpoint
  router.get('/all-banks', authenticate, async (req, res) => {
    try {
      console.log('Requesting all banks from central bank');
      // Force refresh to get the latest data
      const banks = await centralBankService.getAllBanks(true);
      
      res.json({
        status: 'success',
        count: banks.length,
        data: banks
      });
    } catch (error) {
      console.error('Error fetching all banks:', error);
      res.status(500).json({
        status: 'error',
        message: `Failed to fetch banks: ${error.message}`
      });
    }
  });
}

module.exports = router;
