const fetch = require('node-fetch');
const cache = require('../utils/cache');

/**
 * Service for interacting with the Central Bank API
 */
class CentralBankService {
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
   * @returns {Object} Registration result
   */
  async reRegisterBank() {
    try {
      console.log('Auto re-registering bank with central bank...');
      
      // Prepare registration data from environment variables
      const registrationData = {
        name: process.env.BANK_NAME || 'Bank API',
        owners: process.env.BANK_OWNERS || 'Bank Owner',
        jwksUrl: process.env.JWKS_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/jwks.json`,
        transactionUrl: process.env.TRANSACTION_URL || `https://${process.env.HOSTNAME || 'bank.example.com'}/transactions/b2b`
      };
      
      console.log('Re-registration data:', registrationData);
      
      // Store the old bank prefix for later comparison
      const oldBankPrefix = process.env.BANK_PREFIX;
      
      // Call the registration method
      const result = await this.registerBank(registrationData);
      
      console.log('Bank re-registration successful:', result);
      
      // Save registration data to .env only
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Update .env file
        const envPath = path.join(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          
          // Check if the bank prefix has changed
          let prefixChanged = false;
          
          // Update BANK_PREFIX if provided
          if (result.bankPrefix) {
            if (result.bankPrefix !== oldBankPrefix) {
              prefixChanged = true;
            }
            
            if (envContent.includes('BANK_PREFIX=')) {
              envContent = envContent.replace(/BANK_PREFIX=.*(\r?\n|$)/g, `BANK_PREFIX=${result.bankPrefix}$1`);
            } else {
              envContent += `\nBANK_PREFIX=${result.bankPrefix}`;
            }
          }
          
          // Update API_KEY if provided
          if (result.apiKey) {
            if (envContent.includes('API_KEY=')) {
              envContent = envContent.replace(/API_KEY=.*(\r?\n|$)/g, `API_KEY=${result.apiKey}$1`);
            } else {
              envContent += `\nAPI_KEY=${result.apiKey}`;
            }
          }
          
          // Write updated content back to .env file
          fs.writeFileSync(envPath, envContent);
          console.log('Updated environment variables in .env file');
          
          // Also update process.env for the current process
          if (result.bankPrefix) process.env.BANK_PREFIX = result.bankPrefix;
          if (result.apiKey) process.env.API_KEY = result.apiKey;
          
          // Update all account numbers if the prefix has changed
          if (prefixChanged && oldBankPrefix) {
            console.log(`Bank prefix changed from ${oldBankPrefix} to ${result.bankPrefix}. Updating account numbers...`);
            await this.updateAllAccountNumbers(oldBankPrefix, result.bankPrefix);
          }
        } else {
          console.warn('.env file not found, could not update environment variables');
        }
      } catch (fileError) {
        console.error('Failed to update .env with re-registration data:', fileError);
      }
      
      return result;
    } catch (error) {
      console.error('Error re-registering bank:', error);
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
      // Get access to the in-memory store
      const { accounts, transactions } = require('../models/inMemoryStore');
      
      // Keep track of account number mapping for transaction updates
      const accountMapping = {};
      
      // Update all account numbers in accounts array
      for (const account of accounts) {
        // Only update accounts with our bank prefix
        if (account.accountNumber.startsWith(oldPrefix)) {
          const oldAccountNumber = account.accountNumber;
          // Replace the prefix at the beginning of the account number
          account.accountNumber = newPrefix + account.accountNumber.substring(oldPrefix.length);
          
          // Store the mapping for transaction updates
          accountMapping[oldAccountNumber] = account.accountNumber;
          
          console.log(`Updated account ${oldAccountNumber} to ${account.accountNumber}`);
        }
      }
      
      // Update all transaction references to these accounts
      let transactionsUpdated = 0;
      for (const transaction of transactions) {
        // Check and update fromAccount
        if (accountMapping[transaction.fromAccount]) {
          transaction.fromAccount = accountMapping[transaction.fromAccount];
          transactionsUpdated++;
        }
        
        // Check and update toAccount
        if (accountMapping[transaction.toAccount]) {
          transaction.toAccount = accountMapping[transaction.toAccount];
          transactionsUpdated++;
        }
      }
      
      console.log(`Updated ${Object.keys(accountMapping).length} accounts and ${transactionsUpdated} transaction references`);
      
      return {
        accountsUpdated: Object.keys(accountMapping).length,
        transactionsUpdated
      };
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
      // Return from cache if available
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
      const allBanks = await this.getAllBanks();
      
      // Find the bank with matching prefix
      const bank = allBanks.find(bank => bank.bankPrefix === prefix);
      
      // If this is our own bank prefix and it's not found, try to re-register
      if (!bank && prefix === process.env.BANK_PREFIX) {
        console.warn(`Our bank with prefix ${prefix} not found in central bank registry. Attempting to re-register...`);
        
        try {
          // Try to re-register the bank
          await this.reRegisterBank();
          
          // Retry the lookup after registration
          const refreshedBanks = await this.getAllBanks(true);
          const refreshedBank = refreshedBanks.find(bank => bank.bankPrefix === prefix);
          
          if (refreshedBank) {
            console.log(`Successfully re-registered and found our bank: ${refreshedBank.name} (${refreshedBank.bankPrefix})`);
            
            // Cache the result
            this.bankCache.set(prefix, {
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
    // Check if it's our own bank prefix
    if (prefix === process.env.BANK_PREFIX) {
      console.log('Request was for our own bank, returning our own details');
      return {
        id: 999,
        name: process.env.BANK_NAME || 'Our Bank',
        bankPrefix: process.env.BANK_PREFIX,
        owners: process.env.BANK_OWNERS || 'Bank Owner',
        jwksUrl: process.env.JWKS_URL,
        transactionUrl: process.env.TRANSACTION_URL
      };
    }
    
    return null;
  }
}

// Export singleton instance
module.exports = new CentralBankService();
