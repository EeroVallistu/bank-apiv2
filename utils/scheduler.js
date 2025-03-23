const centralBankService = require('../services/centralBankService');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

/**
 * Task Scheduler for handling periodic background tasks
 */
class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    if (this.isRunning) return;
    
    console.log('Starting scheduler for background tasks');
    this.isRunning = true;
    
    // Schedule bank registration check
    this.scheduleRegistrationCheck();
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) return;
    
    console.log('Stopping scheduler');
    this.isRunning = false;
    
    // Clear all intervals
    for (const [taskName, intervalId] of this.tasks.entries()) {
      clearInterval(intervalId);
      console.log(`Stopped task: ${taskName}`);
    }
    
    this.tasks.clear();
  }

  /**
   * Schedule bank registration check to run periodically
   */
  scheduleRegistrationCheck() {
    // Define check interval (5 minutes = 300,000 ms)
    const CHECK_INTERVAL = 5 * 60 * 1000;
    
    // Run the check immediately
    this.checkBankRegistration();
    
    // Then schedule recurring checks
    const intervalId = setInterval(() => this.checkBankRegistration(), CHECK_INTERVAL);
    this.tasks.set('bankRegistrationCheck', intervalId);
    
    console.log(`Scheduled bank registration check every 5 minutes`);
  }

  /**
   * Get the current bank prefix directly from .env file
   * @returns {string|null} The current bank prefix or null if not found
   */
  getCurrentBankPrefix() {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/BANK_PREFIX=([^\r\n]+)/);
      return match ? match[1].trim() : null;
    } catch (error) {
      console.error('Error reading bank prefix from .env:', error.message);
      return null;
    }
  }

  /**
   * Check if the bank is still registered with the central bank
   * and reregister if needed
   */
  async checkBankRegistration() {
    try {
      console.log('Checking bank registration status with central bank...');
      
      // Get bank prefix directly from .env file
      const bankPrefix = this.getCurrentBankPrefix();
      
      // Skip if bank prefix is not set
      if (!bankPrefix) {
        console.log('Bank prefix not set, skipping registration check');
        return;
      }
      
      console.log(`Using bank prefix: ${bankPrefix}`);
      
      // Check registration using the centralized method, which also handles account updates
      const isRegistered = await centralBankService.checkBankRegistration();
      
      if (!isRegistered) {
        console.log('Bank not found in central bank registry. Attempting to re-register...');
        
        // Pass the current bank prefix for re-registration
        const result = await centralBankService.reRegisterBank(bankPrefix);
        console.log('Bank re-registration result:', result);
        
        // Force an account number update after re-registration
        console.log('Verifying account numbers after re-registration...');
        await centralBankService.updateOutdatedAccounts(result.bankPrefix || process.env.BANK_PREFIX);
      }
    } catch (error) {
      console.error('Error checking bank registration:', error);
    }
  }
}

// Export singleton instance
module.exports = new Scheduler();
