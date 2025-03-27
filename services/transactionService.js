const { 
  findAccountByNumber, 
  findUserById, 
  Transaction,
  generateTransactionId
} = require('../models');
const centralBankService = require('./centralBankService');
const currencyService = require('./currencyService');
const keyManager = require('../utils/keyManager');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { 
  NotFoundError, 
  ValidationError, 
  AuthenticationError, 
  APIError 
} = require('../utils/errors');

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
    const destinationAccount = await findAccountByNumber(payload.accountTo);
    if (!destinationAccount) {
      throw new NotFoundError(
        'Account',
        `Destination account ${payload.accountTo} not found`
      );
    }

    // Find the destination account owner
    const destinationUser = await findUserById(destinationAccount.user_id);
    if (!destinationUser) {
      throw new NotFoundError(
        'User', 
        'Destination account owner not found'
      );
    }

    // Convert currency if needed
    let amount = parseFloat(payload.amount);
    let exchangeRate = 1;
    
    if (payload.currency !== destinationAccount.currency) {
      try {
        amount = await currencyService.convert(
          payload.amount,
          payload.currency,
          destinationAccount.currency
        );
        exchangeRate = amount / parseFloat(payload.amount);
      } catch (error) {
        throw new APIError(
          `Currency conversion failed: ${error.message}`,
          500,
          'CURRENCY_CONVERSION_FAILED'
        );
      }
    }

    // Create transaction record with currency info
    const transaction = await Transaction.create({
      from_account: payload.accountFrom,
      to_account: payload.accountTo,
      amount,
      original_amount: parseFloat(payload.amount),
      original_currency: payload.currency,
      currency: destinationAccount.currency,
      exchange_rate: exchangeRate,
      explanation: payload.explanation,
      sender_name: payload.senderName,
      receiver_name: destinationUser.full_name,
      is_external: true,
      status: 'completed',
      created_at: new Date()
    });

    // Credit the destination account with converted amount
    destinationAccount.balance += amount;
    await destinationAccount.save();

    return {
      receiverName: destinationUser.full_name,
      transaction: {
        id: transaction.id,
        fromAccount: transaction.from_account,
        toAccount: transaction.to_account,
        amount: transaction.amount,
        originalAmount: transaction.original_amount,
        originalCurrency: transaction.original_currency,
        currency: transaction.currency,
        exchangeRate: transaction.exchange_rate,
        explanation: transaction.explanation,
        senderName: transaction.sender_name,
        receiverName: transaction.receiver_name,
        isExternal: transaction.is_external,
        status: transaction.status,
        createdAt: transaction.created_at
      }
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
        throw new ValidationError('Invalid JWT format');
      }

      // Validate required fields in payload
      const requiredFields = [
        'accountFrom', 'accountTo', 'currency', 
        'amount', 'explanation', 'senderName'
      ];
      
      const missingFields = [];
      for (const field of requiredFields) {
        if (!decoded.payload[field]) {
          missingFields.push(field);
        }
      }
      
      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(', ')}`,
          missingFields.map(field => ({
            param: field,
            msg: `The ${field} field is required`,
            location: 'body'
          }))
        );
      }

      return decoded;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new ValidationError(
        `JWT parsing error: ${error.message}`
      );
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
        throw new NotFoundError(
          'Bank', 
          `Bank with prefix ${senderBankPrefix} not found`
        );
      }

      // Fetch the sender bank's public key from their JWKS endpoint
      const publicKey = await this.fetchSenderPublicKey(bankDetails.jwksUrl, decodedJWT.header.kid);
      
      return publicKey;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError(
        `Bank validation error: ${error.message}`,
        502,
        'BANK_VALIDATION_ERROR'
      );
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
        throw new APIError(
          `Failed to fetch JWKS: ${response.status}`,
          502,
          'JWKS_FETCH_ERROR'
        );
      }

      const jwks = await response.json();
      
      if (!jwks || !jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        throw new ValidationError('Invalid JWKS format');
      }

      // Find the key with the matching kid
      const key = jwks.keys.find(k => k.kid === keyId);
      
      if (!key) {
        throw new ValidationError(`Key ID ${keyId} not found in JWKS`);
      }

      // Convert JWK to PEM format
      return this.jwkToPem(key);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError(
        `Public key fetch error: ${error.message}`,
        502,
        'PUBLIC_KEY_FETCH_ERROR'
      );
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
      throw new APIError(
        `Error converting JWK to PEM: ${error.message}`,
        500,
        'JWK_TO_PEM_ERROR'
      );
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
      throw new AuthenticationError(`JWT signature verification failed: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new TransactionService();
