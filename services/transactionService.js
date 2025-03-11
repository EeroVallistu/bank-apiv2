const { 
  findAccountByNumber, 
  findUserById, 
  accounts, 
  transactions,
  generateTransactionId
} = require('../models/inMemoryStore');
const centralBankService = require('./centralBankService');
const keyManager = require('../utils/keyManager');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

/**
 * Service for handling transactions between banks
 */
class TransactionService {
  /**
   * Process an incoming transaction from another bank
   * @param {Object} payload Transaction data
   * @returns {Object} Processing result
   */
  async processIncomingTransaction(payload) {
    // Validate destination account exists
    const destinationAccount = findAccountByNumber(payload.accountTo);
    if (!destinationAccount) {
      const error = new Error('Destination account not found');
      error.status = 404;
      error.code = 'ACCOUNT_NOT_FOUND';
      throw error;
    }

    // Find the destination account owner
    const destinationUser = findUserById(destinationAccount.userId);
    if (!destinationUser) {
      const error = new Error('Destination account owner not found');
      error.status = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    // Convert currency if needed
    let amount = parseFloat(payload.amount);
    let exchangeRate = 1;
    
    if (payload.currency !== destinationAccount.currency) {
      amount = await currencyService.convert(
        payload.amount,
        payload.currency,
        destinationAccount.currency
      );
      exchangeRate = amount / parseFloat(payload.amount);
    }

    // Create transaction record with currency info
    const transaction = {
      id: generateTransactionId(),
      fromAccount: payload.accountFrom,
      toAccount: payload.accountTo,
      amount,
      originalAmount: parseFloat(payload.amount),
      originalCurrency: payload.currency,
      currency: destinationAccount.currency,
      exchangeRate,
      explanation: payload.explanation,
      senderName: payload.senderName,
      receiverName: destinationUser.fullName,
      isExternal: true,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    // Credit the destination account with converted amount
    destinationAccount.balance += amount;
    
    // Add transaction to store
    transactions.push(transaction);

    return {
      receiverName: destinationUser.fullName,
      transaction
    };
  }

  /**
   * Validate JWT structure
   * @param {string} token JWT token
   * @returns {Object} Decoded JWT payload
   */
  async validateJWTStructure(token) {
    try {
      // Just decode without verification first to get header and payload
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded || !decoded.header || !decoded.payload) {
        const error = new Error('Invalid JWT format');
        error.status = 400;
        error.code = 'INVALID_JWT_FORMAT';
        throw error;
      }

      // Validate required fields in payload
      const requiredFields = [
        'accountFrom', 'accountTo', 'currency', 
        'amount', 'explanation', 'senderName'
      ];
      
      for (const field of requiredFields) {
        if (!decoded.payload[field]) {
          const error = new Error(`Missing required field: ${field}`);
          error.status = 400;
          error.code = 'MISSING_REQUIRED_FIELD';
          throw error;
        }
      }

      return decoded;
    } catch (error) {
      if (!error.status) {
        error.status = 400;
        error.code = 'JWT_PARSING_ERROR';
      }
      throw error;
    }
  }

  /**
   * Validate sender bank
   * @param {Object} decodedJWT Decoded JWT
   * @returns {string} Public key of the sender bank
   */
  async validateSenderBank(decodedJWT) {
    try {
      // Extract the bank prefix from the sender's account number
      const senderBankPrefix = decodedJWT.payload.accountFrom.substring(0, 3);
      
      // Get the sender bank details from Central Bank
      const bankDetails = await centralBankService.getBankDetails(senderBankPrefix);
      
      if (!bankDetails) {
        const error = new Error(`Bank with prefix ${senderBankPrefix} not found`);
        error.status = 404;
        error.code = 'BANK_NOT_FOUND';
        throw error;
      }

      // Fetch the sender bank's public key from their JWKS endpoint
      const publicKey = await this.fetchSenderPublicKey(bankDetails.jwksUrl, decodedJWT.header.kid);
      
      return publicKey;
    } catch (error) {
      if (!error.status) {
        error.status = 502;
        error.code = 'BANK_VALIDATION_ERROR';
      }
      throw error;
    }
  }

  /**
   * Fetch sender bank's public key from their JWKS endpoint
   * @param {string} jwksUrl JWKS URL
   * @param {string} keyId Key ID
   * @returns {string} Public key in PEM format
   */
  async fetchSenderPublicKey(jwksUrl, keyId) {
    try {
      const response = await fetch(jwksUrl);
      
      if (!response.ok) {
        const error = new Error(`Failed to fetch JWKS: ${response.status}`);
        error.status = 502;
        error.code = 'JWKS_FETCH_ERROR';
        throw error;
      }

      const jwks = await response.json();
      
      if (!jwks || !jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        const error = new Error('Invalid JWKS format');
        error.status = 502;
        error.code = 'INVALID_JWKS_FORMAT';
        throw error;
      }

      // Find the key with the matching kid
      const key = jwks.keys.find(k => k.kid === keyId);
      
      if (!key) {
        const error = new Error(`Key ID ${keyId} not found in JWKS`);
        error.status = 400;
        error.code = 'KEY_NOT_FOUND';
        throw error;
      }

      // Convert JWK to PEM format
      return this.jwkToPem(key);
    } catch (error) {
      if (!error.status) {
        error.status = 502;
        error.code = 'PUBLIC_KEY_FETCH_ERROR';
      }
      throw error;
    }
  }

  /**
   * Convert JWK to PEM format
   * @param {Object} jwk JSON Web Key
   * @returns {string} Public key in PEM format
   */
  jwkToPem(jwk) {
    // In a real implementation, you would use a library like jwk-to-pem
    // For simplicity in this example, we'll simulate it
    // This is NOT secure for production!
    try {
      const crypto = require('crypto');
      const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      return publicKey.export({ type: 'spki', format: 'pem' });
    } catch (error) {
      const customError = new Error('Error converting JWK to PEM: ' + error.message);
      customError.status = 500;
      customError.code = 'JWK_TO_PEM_ERROR';
      throw customError;
    }
  }

  /**
   * Verify JWT signature using public key
   * @param {string} token JWT token
   * @param {string} publicKey Public key in PEM format
   * @returns {Object} Verified JWT payload
   */
  async verifyJWTSignature(token, publicKey) {
    try {
      return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    } catch (error) {
      const customError = new Error('JWT signature verification failed: ' + error.message);
      customError.status = 401;
      customError.code = 'JWT_SIGNATURE_INVALID';
      throw customError;
    }
  }

  /**
   * Handle errors in incoming transaction processing
   * @param {Object} transaction Transaction object
   * @param {Error} error Error that occurred
   */
  async handleIncomingTransactionError(transaction, error) {
    console.error('Error processing incoming transaction:', error);
    
    // Update transaction status if it exists
    if (transaction) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
    }
    
    // Return error with proper code and status
    if (!error.status) {
      error.status = 500;
    }
    if (!error.code) {
      error.code = 'TRANSACTION_PROCESSING_ERROR';
    }
  }
}

// Export singleton instance
module.exports = new TransactionService();
