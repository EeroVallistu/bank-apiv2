const centralBankService = require('../services/centralBankService');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

/**
 * Task scheduler for the bank API
 * Handles recurring background tasks
 */
class Scheduler {
  constructor() {
    this.tasks = {};
    this.running = false;
  }

  /**
   * Adds a new task to the scheduler
   * @param {string} name - Task identifier
   * @param {Function} task - Function to execute
   * @param {number} interval - Interval in milliseconds
   */
  addTask(name, task, interval) {
    if (this.tasks[name]) {
      this.removeTask(name);
    }
    
    console.log(`Adding scheduled task: ${name} (every ${interval}ms)`);
    this.tasks[name] = {
      fn: task,
      interval: interval,
      lastRun: null,
      timer: setInterval(() => {
        try {
          console.log(`Running scheduled task: ${name}`);
          task();
          this.tasks[name].lastRun = new Date();
        } catch (error) {
          console.error(`Error in scheduled task ${name}:`, error);
        }
      }, interval)
    };
  }

  /**
   * Removes a task from the scheduler
   * @param {string} name - Task identifier
   */
  removeTask(name) {
    if (this.tasks[name]) {
      clearInterval(this.tasks[name].timer);
      delete this.tasks[name];
      console.log(`Removed scheduled task: ${name}`);
    }
  }

  /**
   * Starts the scheduler with default tasks
   */
  start() {
    if (this.running) return;
    
    console.log('Starting scheduler...');
    
    // Add default tasks
    
    // Clean expired sessions every hour
    this.addTask('cleanSessions', async () => {
      try {
        if (process.env.USE_DATABASE === 'true') {
          const { Session } = require('../models');
          const result = await Session.destroy({
            where: {
              expires_at: { [Op.lt]: new Date() }
            }
          });
          console.log(`Cleaned ${result} expired sessions`);
        }
      } catch (error) {
        console.error('Error cleaning expired sessions:', error);
      }
    }, 60 * 60 * 1000);
    
    this.running = true;
    console.log('Scheduler started');
  }

  /**
   * Stops the scheduler and all tasks
   */
  stop() {
    console.log('Stopping scheduler...');
    Object.keys(this.tasks).forEach(name => {
      this.removeTask(name);
    });
    this.running = false;
    console.log('Scheduler stopped');
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

module.exports = new Scheduler();
