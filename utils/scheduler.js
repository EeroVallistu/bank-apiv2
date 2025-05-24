const centralBankService = require('../services/centralBankService');
const { Op } = require('sequelize');
const { logger } = require('./logger');

/**
 * Task scheduler for the bank API
 * Handles recurring background tasks
 */
class Scheduler {
  constructor() {
    this.tasks = {};
    this.running = false;
    this.initialCheckTimeout = null;
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
    
    logger.info(`Adding scheduled task: ${name} (every ${interval}ms)`);
    this.tasks[name] = {
      fn: task,
      interval: interval,
      lastRun: null,
      timer: setInterval(() => {
        try {
          logger.info(`Running scheduled task: ${name}`);
          task();
          this.tasks[name].lastRun = new Date();
        } catch (error) {
          logger.error(`Error in scheduled task ${name}:`, { error: error.message, stack: error.stack });
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
      logger.info(`Removed scheduled task: ${name}`);
    }
  }

  /**
   * Starts the scheduler with default tasks
   */
  start() {
    if (this.running) return;
    
    logger.info('Starting scheduler...');
    
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
          logger.info(`Cleaned ${result} expired sessions`);
        }
      } catch (error) {
        logger.error('Error cleaning expired sessions:', { error: error.message, stack: error.stack });
      }
    }, 60 * 60 * 1000);
    
    // Check bank registration with central bank every 5 minutes
    this.addTask('checkBankRegistration', async () => {
      try {
        await this.checkBankRegistration();
      } catch (error) {
        logger.error('Error checking bank registration:', { error: error.message, stack: error.stack });
      }
    }, 5 * 60 * 1000);
    
    // Run immediate bank registration check on startup
    logger.info('Running initial bank registration check...');
    this.initialCheckTimeout = setTimeout(() => {
      this.checkBankRegistration().catch(error => {
        logger.error('Error during initial bank registration check:', { error: error.message, stack: error.stack });
      });
    }, 2000); // Short delay to ensure database connection is established
    
    this.running = true;
    logger.info('Scheduler started');
  }

  /**
   * Stops the scheduler and all tasks
   */
  stop() {
    logger.info('Stopping scheduler...');
    
    // Clear all scheduled tasks
    Object.keys(this.tasks).forEach(name => {
      this.removeTask(name);
    });
    
    // Clear initial registration check timeout if it exists
    if (this.initialCheckTimeout) {
      clearTimeout(this.initialCheckTimeout);
      this.initialCheckTimeout = null;
    }
    
    this.running = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Get the current bank prefix from database
   * @returns {Promise<string|null>} The current bank prefix or null if not found
   */
  async getCurrentBankPrefix() {
    try {
      // Check database for bank prefix
      if (process.env.USE_DATABASE === 'true') {
        const DatabaseSync = require('./databaseSync');
        const dbPrefix = await DatabaseSync.getCurrentDatabasePrefix();
        if (dbPrefix) {
          logger.info('Retrieved bank prefix from database:', { bankPrefix: dbPrefix });
          return dbPrefix;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting bank prefix from database:', { error: error.message, stack: error.stack });
      return null;
    }
  }

  /**
   * Check if the bank is still registered with the central bank
   * and reregister if needed
   */
  async checkBankRegistration() {
    try {
      logger.info('Checking bank registration status with central bank...');
      
      // Get bank prefix from database
      const bankPrefix = await this.getCurrentBankPrefix();
      
      // Skip if bank prefix is not set
      if (!bankPrefix) {
        logger.info('Bank prefix not found in database, skipping registration check');
        return;
      }
      
      logger.info(`Using bank prefix: ${bankPrefix}`);
      
      // Check registration using the centralized method, which also handles account updates
      const isRegistered = await centralBankService.checkBankRegistration();
      
      if (!isRegistered) {
        logger.info('Bank not found in central bank registry. Attempting to re-register...');
        
        // Pass the current bank prefix for re-registration
        const result = await centralBankService.reRegisterBank(bankPrefix);
        logger.info('Bank re-registration result:', { result });
        
        // Force an account number update after re-registration
        logger.info('Verifying account numbers after re-registration...');
        await centralBankService.updateOutdatedAccounts(result.bankPrefix || await centralBankService.getOurBankPrefix());
      }
    } catch (error) {
      logger.error('Error checking bank registration:', { error: error.message, stack: error.stack });
    }
  }
}

module.exports = new Scheduler();
