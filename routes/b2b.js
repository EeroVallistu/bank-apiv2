const express = require('express');
const router = express.Router();
const transactionService = require('../services/transactionService');
const keyManager = require('../utils/keyManager');
const cache = require('../middleware/cache');

/**
 * @swagger
 * /transactions/b2b:
 *   post:
 *     summary: Process incoming transfer (Bank-to-Bank)
 *     tags: [Bank-to-Bank]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jwt
 *             properties:
 *               jwt:
 *                 type: string
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6IjEiLCJ0eXAiOiJKV1QifQ.eyJhY2NvdW50RnJvbSI6IjUxMmE3YjIzYzRkNWU2ZjdnODkwIiwiYWNjb3VudFRvIjoiMzUzYzhiNzJlNGE5ZjE1ZDNiODIiLCJjdXJyZW5jeSI6IkVVUiIsImFtb3VudCI6MzAwLjAwLCJleHBsYW5hdGlvbiI6IkludmVzdG1lbnQgcmV0dXJuIiwic2VuZGVyTmFtZSI6IkFsaWNlIEpvaG5zb24ifQ.signature
 *     responses:
 *       200:
 *         description: Transaction processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 receiverName:
 *                   type: string
 *                   example: John Smith
 *       400:
 *         description: Invalid JWT or signature
 *       404:
 *         description: Destination account not found
 *       500:
 *         description: Processing error
 */
// Process bank-to-bank transactions
const processB2BTransaction = async (req, res) => {
  let transaction = null;
  try {
    const { jwt: token } = req.body;
    if (!token) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'JWT token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Decode and validate JWT structure
    const decoded = await transactionService.validateJWTStructure(token);
    
    // Validate sending bank and get its public key
    const publicKey = await transactionService.validateSenderBank(decoded);
    
    // Verify JWT signature
    const verifiedPayload = await transactionService.verifyJWTSignature(token, publicKey);
    
    // Process the transaction
    const result = await transactionService.processIncomingTransaction(verifiedPayload);
    
    res.json({
      status: 'success',
      receiverName: result.receiverName,
      transactionId: result.transaction.id
    });
  } catch (error) {
    await transactionService.handleIncomingTransactionError(transaction, error);
    
    const errorResponse = {
      status: 'error',
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };

    res.status(error.status || 500).json(errorResponse);
  }
};

// B2B Transaction endpoint as per SPECIFICATIONS.md (POST /transactions/b2b)
router.post('/b2b', processB2BTransaction);

// Endpoint without the /b2b suffix for simpler routing
router.post('/', processB2BTransaction);

// Keep old endpoint for backward compatibility, but will be deprecated
router.post('/incoming', processB2BTransaction);

module.exports = router;
