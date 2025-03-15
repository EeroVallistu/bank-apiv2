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
      if (process.env.TEST_MODE === 'true') {
        return this.mockRegisterBank(bankData);
      }

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
          
          // Update BANK_PREFIX if provided
          if (result.bankPrefix) {
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
      
      // Use test mode if enabled
      if (process.env.TEST_MODE === 'true') {
        const mockBanks = this.mockGetAllBanks();
        this.allBanksCache = mockBanks;
        this.allBanksCacheTime = Date.now();
        return mockBanks;
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
      
      // Check if we're in test mode
      if (process.env.TEST_MODE === 'true') {
        return this.mockGetBankDetails(prefix);
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
        owners: 'Bank Owner',
        jwksUrl: process.env.JWKS_URL,
        transactionUrl: process.env.TRANSACTION_URL
      };
    }
    
    // Return a hard-coded bank for specific prefixes (for testing)
    const hardcodedBanks = {
      '777': {
        id: 777,
        name: "Bank 777",
        bankPrefix: "777",
        owners: "Test Owner",
        jwksUrl: "https://bank777.example.com/jwks.json",
        transactionUrl: "https://bank777.example.com/transactions/b2b"
      },
      // Add other known banks here
    };
    
    if (hardcodedBanks[prefix]) {
      console.log(`Using hardcoded bank data for prefix ${prefix}`);
      return hardcodedBanks[prefix];
    }
    
    return null;
  }

  /**
   * Mock functions for testing without actual Central Bank API
   */
  mockRegisterBank(bankData) {
    console.log('TEST MODE: Mock registering bank:', bankData);
    return {
      id: 999,
      name: bankData.name,
      bankPrefix: bankData.bankPrefix || process.env.BANK_PREFIX || '917',
      owners: bankData.owners,
      jwksUrl: bankData.jwksUrl,
      transactionUrl: bankData.transactionUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  mockGetBankDetails(prefix) {
    console.log('TEST MODE: Mock getting bank details for prefix:', prefix);
    
    // Default mock response
    if (prefix === process.env.BANK_PREFIX) {
      return {
        id: 888,
        name: process.env.BANK_NAME || "Our Bank",
        bankPrefix: prefix,
        owners: "Bank Owner",
        jwksUrl: process.env.JWKS_URL || "https://bank.eerovallistu.site/jwks.json",
        transactionUrl: process.env.TRANSACTION_URL || "https://bank.eerovallistu.site/transactions/b2b",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    // For external banks
    return {
      id: 777,
      name: "External Mock Bank",
      bankPrefix: prefix,
      owners: "External Owner",
      jwksUrl: "https://mock-bank.example.com/jwks.json",
      transactionUrl: "https://mock-bank.example.com/transactions/b2b",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  
  mockGetAllBanks() {
    console.log('TEST MODE: Mock getting all banks');
    
    // Create a list with our bank and some mock banks
    const banks = [
      {
        id: 1,
        name: process.env.BANK_NAME || "Our Bank",
        bankPrefix: process.env.BANK_PREFIX || '917',
        owners: "Bank Owner",
        jwksUrl: process.env.JWKS_URL || "https://bank.eerovallistu.site/jwks.json",
        transactionUrl: process.env.TRANSACTION_URL || "https://bank.eerovallistu.site/transactions/b2b"
      },
      {
        id: 2,
        name: "External Bank 1",
        bankPrefix: "123",
        owners: "External Owner 1",
        jwksUrl: "https://bank1.example.com/jwks.json",
        transactionUrl: "https://bank1.example.com/transactions/b2b"
      },
      {
        id: 3,
        name: "External Bank 2",
        bankPrefix: "456",
        owners: "External Owner 2",
        jwksUrl: "https://bank2.example.com/jwks.json",
        transactionUrl: "https://bank2.example.com/transactions/b2b"
      }
    ];
    
    return banks;
  }
}

// Export singleton instance
module.exports = new CentralBankService();
