const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

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
    name: process.env.BANK_NAME || 'Bank API',
    prefix: process.env.BANK_PREFIX || '353'
  });
});

module.exports = router;
