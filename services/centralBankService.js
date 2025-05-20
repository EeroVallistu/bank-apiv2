const { fetch } = require('undici');
const cache = require('../utils/cache');
const fs = require('fs');
const path = require('path');

/**
 * Service for interacting with the Central Bank API
 */
class CentralBankService {
  /**
   * Get our own bank's prefix from the central bank (by name or transaction URL)
   * @returns {Promise<string|null>} The bank prefix or null if not found
   */
  async getOurBankPrefix(forceRefresh = false) {
    const ourBankName = process.env.BANK_NAME || 'Bank API';
    const ourTransactionUrl = process.env.TRANSACTION_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/transactions/b2b`;
    const allBanks = await this.getAllBanks(forceRefresh);
    const ourBank = allBanks.find(bank =>
      bank.name === ourBankName || bank.transactionUrl === ourTransactionUrl
    );
    return ourBank ? ourBank.bankPrefix : null;
  }
  constructor() {
    // Ensure URL doesn't have trailing slash
    this.apiUrl = (process.env.CENTRAL_BANK_URL || 'https://henno.cfd/central-bank').replace(/\/$/, '');
    this.apiKey = process.env.API_KEY;
    this.bankCache = new Map();
    this.cacheTTL = 1000 * 60 * 5; // 5 minutes
    this.allBanksCache = null;
    this.allBanksCacheTime = 0;
  }

  /**
   * Registers bank with the central bank
   * @param {Object} bankData Bank registration data
   */
  async registerBank(bankData) {
    try {
      const response = await fetch(`${this.apiUrl}/banks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify(bankData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to register bank: ${response.status} - ${errorData}`);
      }

      const registrationData = await response.json();
      console.log('Bank registration successful:', registrationData);
      
      // Clear cache after registration
      this.allBanksCache = null;
      
      return registrationData;
    } catch (error) {
      console.error('Error registering bank:', error);
      throw error;
    }
  }

  /**
   * Re-registers bank with the central bank using data from environment variables
   * Used when bank is not found in central bank registry
   * @param {String} currentPrefix The current bank prefix to check against
   * @returns {Object} Registration result
   */
  async reRegisterBank(currentPrefix = null) {
    try {
      // Get all banks and check if our bank exists with any prefix
      console.log('Checking if bank is already registered with any prefix...');
      const allBanks = await this.getAllBanks(true);
      
      // Prepare registration data from environment variables
      const registrationData = {
        name: process.env.BANK_NAME || 'Bank API',
        owners: process.env.BANK_OWNERS || 'Bank Owner',
        jwksUrl: process.env.JWKS_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/jwks.json`,
        transactionUrl: process.env.TRANSACTION_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/transactions/b2b`
      };
      
      // Look for a bank with matching JWKS URL or transaction URL
      const existingBank = allBanks.find(bank => 
        bank.jwksUrl === registrationData.jwksUrl || 
        bank.transactionUrl === registrationData.transactionUrl
      );
      
      if (existingBank) {
        console.log(`Found existing bank registration: ${existingBank.name} (${existingBank.bankPrefix})`);
        
        // Update account numbers if needed
        if (currentPrefix && currentPrefix !== existingBank.bankPrefix) {
          console.log(`Updating account numbers from ${currentPrefix} to ${existingBank.bankPrefix}`);
          await this.updateAllAccountNumbers(currentPrefix, existingBank.bankPrefix);
        }
        
        return existingBank;
      }
      
      // If we reach here, no existing bank was found, so register new one
      console.log('No existing registration found. Registering bank with central bank...');
      console.log('Registration data:', registrationData);
      
      // Get current bank prefix from database for comparison
      const oldBankPrefix = await this.getOurBankPrefix(true);
      
      // Call the registration method
      const result = await this.registerBank(registrationData);
      
      console.log('Bank registration successful:', result);
      
      // Update all account numbers if the prefix has changed
      if (result.bankPrefix && result.bankPrefix !== oldBankPrefix && oldBankPrefix) {
        console.log(`Bank prefix changed from ${oldBankPrefix} to ${result.bankPrefix}. Updating account numbers...`);
        await this.updateAllAccountNumbers(oldBankPrefix, result.bankPrefix);
      }
      
      return result;
    } catch (error) {
      console.error('Error re-registering bank:', error);
      
      // Try to recover by finding the existing bank
      try {
        console.log('Attempting to recover by finding existing bank registration...');
        const allBanks = await this.getAllBanks(true);
        const registrationData = {
          jwksUrl: process.env.JWKS_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/jwks.json`,
          transactionUrl: process.env.TRANSACTION_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/transactions/b2b`
        };
        
        const existingBank = allBanks.find(bank => 
          bank.jwksUrl === registrationData.jwksUrl || 
          bank.transactionUrl === registrationData.transactionUrl
        );
        
        if (existingBank) {
          console.log(`Found existing bank: ${existingBank.name} (${existingBank.bankPrefix})`);
          return existingBank;
        }
      } catch (recoveryError) {
        console.error('Recovery attempt failed:', recoveryError);
      }
      
      throw error;
    }
  }

  /**
   * Update all account numbers when the bank prefix changes
   * @param {string} oldPrefix The old bank prefix
   * @param {string} newPrefix The new bank prefix
   */
  async updateAllAccountNumbers(oldPrefix, newPrefix) {
    try {
      // Get access to the database models
      const { Account, Transaction, sequelize } = require('../models');
      
      // Begin a transaction to ensure all updates succeed or fail together
      const t = await sequelize.transaction();
      
      try {
        // Find ALL accounts regardless of their prefix
        const accounts = await Account.findAll({
          transaction: t
        });
        
        console.log(`Found ${accounts.length} accounts to update`);
        
        // Keep track of account number mapping for transaction updates
        const accountMapping = {};
        
        // Update all account numbers
        for (const account of accounts) {
          const oldAccountNumber = account.account_number;
          // Replace any existing prefix or add the new prefix
          const newAccountNumber = newPrefix + oldAccountNumber.substring(3);
          
          // Store the mapping for transaction updates
          accountMapping[oldAccountNumber] = newAccountNumber;
          
          // Update the account number
          account.account_number = newAccountNumber;
          await account.save({ transaction: t });
          
          console.log(`Updated account ${oldAccountNumber} to ${newAccountNumber}`);
        }
        
        let transactionsUpdated = 0;
        
        // Update transactions only if we have accounts to update
        if (Object.keys(accountMapping).length > 0) {
          // Update from_account
          for (const [oldAccount, newAccount] of Object.entries(accountMapping)) {
            const fromUpdated = await Transaction.update(
              { from_account: newAccount },
              { 
                where: { from_account: oldAccount },
                transaction: t
              }
            );
            
            transactionsUpdated += fromUpdated[0];
          }
          
          // Update to_account
          for (const [oldAccount, newAccount] of Object.entries(accountMapping)) {
            const toUpdated = await Transaction.update(
              { to_account: newAccount },
              { 
                where: { to_account: oldAccount },
                transaction: t
              }
            );
            
            transactionsUpdated += toUpdated[0];
          }
        } else {
          console.log('No accounts found. No transactions need updating.');
        }
        
        // Commit the transaction
        await t.commit();
        
        console.log(`Updated ${accounts.length} accounts and ${transactionsUpdated} transaction references`);
        
        return {
          accountsUpdated: accounts.length,
          transactionsUpdated
        };
      } catch (error) {
        // Rollback the transaction on error
        await t.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error updating account numbers:', error);
      throw new Error(`Failed to update account numbers: ${error.message}`);
    }
  }

  /**
   * Get all banks from central bank
   * @param {Boolean} forceRefresh Force refresh from central bank
   * @returns {Array} List of banks
   */
  async getAllBanks(forceRefresh = false) {
    try {
      // Use cache if available and not forcing refresh
      if (!forceRefresh && this.allBanksCache && 
          (Date.now() - this.allBanksCacheTime < this.cacheTTL)) {
        console.log('Using cached banks list');
        return this.allBanksCache;
      }
      
      console.log('Fetching all banks from central bank API');
      
      const response = await fetch(`${this.apiUrl}/banks`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': this.apiKey || ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get banks: ${response.status}`);
      }
      
      const banks = await response.json();
      console.log(`Retrieved ${banks.length} banks from central bank`);
      
      // Cache the results
      this.allBanksCache = banks;
      this.allBanksCacheTime = Date.now();
      
      return banks;
    } catch (error) {
      console.error('Error fetching all banks:', error);
      throw error;
    }
  }

  /**
   * Get bank details by prefix
   * @param {String} prefix Bank prefix
   * @param {Boolean} forceRefresh Force refresh from central bank
   * @returns {Object|null} Bank details or null if not found
   */
  async getBankDetails(prefix, forceRefresh = false) {
    try {
      // Return from cache if available and not forced to refresh
      if (!forceRefresh && this.bankCache.has(prefix)) {
        const cached = this.bankCache.get(prefix);
        if (cached.timestamp > Date.now() - this.cacheTTL) {
          console.log(`Using cached bank details for prefix ${prefix}`);
          return cached.data;
        }
        // Cache expired, remove it
        this.bankCache.delete(prefix);
      }

      // Get all banks and find the one with matching prefix
      console.log(`Looking up bank with prefix ${prefix}`);
      const allBanks = await this.getAllBanks(forceRefresh);
      
      // Find the bank with matching prefix
      const bank = allBanks.find(bank => bank.bankPrefix === prefix);
      
      // Get our bank prefix
      const ourBankPrefix = await this.getOurBankPrefix();
      
      // If this is our own bank prefix and it's not found, try to re-register
      if (!bank && prefix === ourBankPrefix) {
        console.warn(`Our bank with prefix ${prefix} not found in central bank registry. Attempting to re-register...`);
        
        // Look for a bank with our name or transaction URL
        const ourBankName = process.env.BANK_NAME || 'Bank API';
        const ourTransactionUrl = process.env.TRANSACTION_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/transactions/b2b`;
        
        const existingBank = allBanks.find(bank => 
          bank.name === ourBankName || 
          bank.transactionUrl === ourTransactionUrl
        );
        
        if (existingBank) {
          console.log(`Found our bank with different prefix: ${existingBank.bankPrefix} instead of ${prefix}`);
          // Update account numbers if needed
          if (prefix && prefix !== existingBank.bankPrefix) {
            console.log(`Updating account numbers from ${prefix} to ${existingBank.bankPrefix}`);
            await this.updateAllAccountNumbers(prefix, existingBank.bankPrefix);
          }
          
          // Cache the result
          this.bankCache.set(existingBank.bankPrefix, {
            data: existingBank,
            timestamp: Date.now()
          });
          
          return existingBank;
        }
        
        try {
          // Try to re-register the bank
          await this.reRegisterBank(prefix);
          
          // Retry the lookup after registration
          const refreshedBanks = await this.getAllBanks(true);
          const ourBankPrefix = await this.getOurBankPrefix(true);
          const refreshedBank = refreshedBanks.find(bank => bank.bankPrefix === ourBankPrefix);
          
          if (refreshedBank) {
            console.log(`Successfully re-registered and found our bank: ${refreshedBank.name} (${refreshedBank.bankPrefix})`);
            
            // Cache the result
            this.bankCache.set(refreshedBank.bankPrefix, {
              data: refreshedBank,
              timestamp: Date.now()
            });
            
            return refreshedBank;
          }
        } catch (regError) {
          console.error('Failed to re-register bank:', regError);
        }
      }
      
      if (!bank) {
        console.warn(`Bank with prefix ${prefix} not found in central bank registry`);
        // Cache the negative result to avoid repeated calls
        this.bankCache.set(prefix, {
          data: null,
          timestamp: Date.now()
        });
        return null;
      }
      
      console.log(`Found bank: ${bank.name} (${bank.bankPrefix})`);
      
      // Cache the successful result
      this.bankCache.set(prefix, {
        data: bank,
        timestamp: Date.now()
      });
      
      return bank;
    } catch (error) {
      console.error(`Error fetching bank details for prefix ${prefix}:`, error);
      
      // Try fallback methods
      const fallbackData = await this.tryBankFallbacks(prefix);
      if (fallbackData) {
        return fallbackData;
      }
      
      throw error;
    }
  }

  /**
   * Try fallback sources for bank data
   * @param {String} prefix Bank prefix
   * @returns {Object|null} Bank data or null if not found
   */
  async tryBankFallbacks(prefix) {
    // Get our bank prefix
    const ourBankPrefix = await this.getOurBankPrefix();
    
    // Check if it's our own bank prefix
    if (prefix === ourBankPrefix) {
      console.log('Request was for our own bank, returning our own details');
      return {
        id: 999,
        name: process.env.BANK_NAME || 'Our Bank',
        bankPrefix: ourBankPrefix,
        owners: process.env.BANK_OWNERS || 'Bank Owner',
        jwksUrl: process.env.JWKS_URL,
        transactionUrl: process.env.TRANSACTION_URL
      };
    }
    
    return null;
  }

  /**
   * Regular bank check to ensure registration is still valid
   * Called by the scheduler
   */
  async checkBankRegistration() {
    try {
      console.log('Checking bank registration with central bank...');
      
      // First, try to get our current bank prefix from database
      const { Setting } = require('../models');
      const prefixSetting = await Setting.findOne({
        where: { name: 'bank_prefix' }
      });
      
      const currentPrefix = prefixSetting ? prefixSetting.value : null;
      
      if (currentPrefix) {
        console.log(`Checking if bank with prefix ${currentPrefix} exists`);
        
        // Get all banks from central bank
        const allBanks = await this.getAllBanks(true);
        
        // Check if our prefix exists
        const bankWithPrefix = allBanks.find(bank => bank.bankPrefix === currentPrefix);
        
        if (bankWithPrefix) {
          console.log(`Found our bank by prefix: ${bankWithPrefix.name} (${bankWithPrefix.bankPrefix})`);
          return true;
        }
        
        console.log(`No bank found with prefix ${currentPrefix}, checking URLs...`);
      } else {
        console.log('No bank prefix found in database, checking URLs...');
      }
      
      // If we couldn't find by prefix, check by URLs
      const jwksUrl = process.env.JWKS_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/jwks.json`;
      const transactionUrl = process.env.TRANSACTION_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/transactions/b2b`;
      
      console.log(`Looking for bank with JWKS URL: ${jwksUrl} or transaction URL: ${transactionUrl}`);
      
      // Get all banks if we haven't already
      const allBanks = currentPrefix ? await this.getAllBanks(false) : await this.getAllBanks(true);
      
      const ourBank = allBanks.find(bank => 
        bank.jwksUrl === jwksUrl || 
        bank.transactionUrl === transactionUrl
      );
      
      if (ourBank) {
        console.log(`Found our bank by URLs: ${ourBank.name} (${ourBank.bankPrefix})`);
        
        // Update our prefix in database if it's different
        if (currentPrefix !== ourBank.bankPrefix) {
          console.log(`Bank prefix in database (${currentPrefix}) doesn't match central bank (${ourBank.bankPrefix}), updating...`);
          
          // Update the database setting
          if (prefixSetting) {
            await prefixSetting.update({ value: ourBank.bankPrefix });
          } else {
            await Setting.create({
              name: 'bank_prefix',
              value: ourBank.bankPrefix,
              description: 'Bank prefix for account numbers'
            });
          }
          
          // Check if any accounts need prefix updates
          await this.updateOutdatedAccounts(ourBank.bankPrefix);
        }
        
        return true;
      }
      
      console.log('Our bank not found in central bank registry, registration required');
      return false;
    } catch (error) {
      console.error('Error checking bank registration:', error);
      return false;
    }
  }

  /**
   * Check and update account numbers that don't match the current bank prefix
   * @param {string} currentPrefix The current correct bank prefix
   */
  async updateOutdatedAccounts(currentPrefix) {
    try {
      if (!currentPrefix) return;
      
      const { Account, sequelize } = require('../models');
      
      // Get first few characters from all account numbers
      const accountPrefixes = await Account.findAll({
        attributes: [
          [sequelize.fn('DISTINCT', sequelize.fn('LEFT', sequelize.col('account_number'), 3)), 'prefix']
        ],
        raw: true
      });
      
      // Extract the prefixes
      const prefixes = accountPrefixes.map(row => row.prefix);
      console.log('Found account prefixes in database:', prefixes);
      
      // Update accounts with mismatched prefixes
      for (const prefix of prefixes) {
        if (prefix && prefix !== currentPrefix) {
          console.log(`Found accounts with outdated prefix: ${prefix}, updating to ${currentPrefix}`);
          await this.updateAllAccountNumbers(prefix, currentPrefix);
        }
      }
    } catch (error) {
      console.error('Error checking for outdated account prefixes:', error);
    }
  }
}

// Export singleton instance
module.exports = new CentralBankService();
