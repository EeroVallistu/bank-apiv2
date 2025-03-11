const fetch = require('node-fetch');
const cache = require('../utils/cache');

/**
 * Service for interacting with the Central Bank API
 */
class CentralBankService {
  constructor() {
    this.apiUrl = process.env.CENTRAL_BANK_URL || 'https://henno.cfd/central-bank';
    this.apiKey = process.env.API_KEY;
    this.bankCache = new Map();
    this.cacheTTL = 1000 * 60 * 15; // 15 minutes
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

      return await response.json();
    } catch (error) {
      console.error('Error registering bank:', error);
      throw error;
    }
  }

  /**
   * Get bank details by prefix
   * @param {String} prefix Bank prefix
   */
  async getBankDetails(prefix) {
    try {
      // Check cache first
      if (this.bankCache.has(prefix)) {
        const cached = this.bankCache.get(prefix);
        if (cached.timestamp > Date.now() - this.cacheTTL) {
          return cached.data;
        }
      }
      
      // Check test mode
      if (process.env.TEST_MODE === 'true') {
        return this.mockGetBankDetails(prefix);
      }

      const response = await fetch(`${this.apiUrl}/banks/${prefix}`, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get bank details: ${response.status}`);
      }

      const bankData = await response.json();
      
      // Cache the result
      this.bankCache.set(prefix, {
        data: bankData,
        timestamp: Date.now()
      });
      
      return bankData;
    } catch (error) {
      console.error(`Error fetching bank details for prefix ${prefix}:`, error);
      throw error;
    }
  }

  /**
   * Mock functions for testing without actual Central Bank API
   */
  mockRegisterBank(bankData) {
    console.log('TEST MODE: Mock registering bank:', bankData);
    return {
      id: 999,
      name: bankData.name,
      bankPrefix: bankData.bankPrefix,
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
    const mockBank = {
      id: 888,
      name: "Mock Bank",
      bankPrefix: prefix,
      owners: "Tester",
      jwksUrl: "http://localhost:8080/jwks.json",
      transactionUrl: "http://localhost:8080/transfers/incoming",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // If prefix in bankreg.txt, use that data
    try {
      const fs = require('fs');
      const path = require('path');
      const bankregPath = path.join(__dirname, '../bankreg.txt');
      
      if (fs.existsSync(bankregPath)) {
        const content = fs.readFileSync(bankregPath, 'utf8');
        const bankRegData = JSON.parse(content);
        
        if (bankRegData && bankRegData.bankPrefix === prefix) {
          return bankRegData;
        }
      }
    } catch (error) {
      console.error('Error reading bankreg.txt:', error);
    }
    
    return mockBank;
  }
}

// Export singleton instance
module.exports = new CentralBankService();
