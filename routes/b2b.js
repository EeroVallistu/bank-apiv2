const express = require('express');
const router = express.Router();
const transactionService = require('../services/transactionService');
const keyManager = require('../utils/keyManager');
const { ValidationError, APIError } = require('../utils/errors');

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
const processB2BTransaction = async (req, res, next) => {
  let transaction = null;
  try {
    const { jwt: token } = req.body;
    if (!token) {
      throw new ValidationError('JWT token required', [{ 
        param: 'jwt', 
        msg: 'JWT token is required',
        location: 'body' 
      }]);
    }

    // Decode and validate JWT structure
    const decoded = await transactionService.validateJWTStructure(token);
    
    // Validate sending bank and get its public key
    const publicKey = await transactionService.validateSenderBank(decoded);
    
    // Verify JWT signature
    const verifiedPayload = await transactionService.verifyJWTSignature(token, publicKey);
    
    // Process the transaction
    const result = await transactionService.processIncomingTransaction(verifiedPayload);
    
    // Use explicit status code for successful response
    res.status(200).json({
      status: 'success',
      receiverName: result.receiverName,
      transactionId: result.transaction.id
    });
  } catch (error) {
    // If it's already an APIError, pass it through
    if (error instanceof APIError) {
      return next(error);
    }
    
    // Otherwise handle based on error properties
    if (error.status && error.code) {
      const apiError = new APIError(error.message, error.status, error.code);
      return next(apiError);
    }
    
    // Default to passing the error to the handler
    next(error);
  }
};

// B2B Transaction endpoint as per SPECIFICATIONS.md (POST /transactions/b2b)
router.post('/b2b', processB2BTransaction);

// Endpoint without the /b2b suffix for simpler routing
router.post('/', processB2BTransaction);

// Keep old endpoint for backward compatibility, but will be deprecated
router.post('/incoming', processB2BTransaction);

module.exports = router;
