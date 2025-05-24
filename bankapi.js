require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression'); // Add compression
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import logger
const { logger } = require('./utils/logger');

// Import Redis configuration
const redisConfig = require('./config/redis');
const cacheService = require('./services/cacheService');

// Import middleware
const cache = require('./middleware/cache');
const errorHandler = require('./middleware/errorHandler');

// Database connection
const { sequelize, testConnection } = require('./models/database');
const DatabaseSync = require('./utils/databaseSync');

// Initialize Redis connection
async function initializeRedis() {
  try {
    await redisConfig.connect();
    logger.info('Redis initialization completed');
  } catch (error) {
    logger.warn('Redis initialization failed, continuing with memory cache:', error.message);
  }
}

// Import scheduler if it exists
let scheduler;
try {
  scheduler = require('./utils/scheduler');
  // Start the scheduler
  scheduler.start();
  logger.info('Scheduler started successfully');
} catch (error) {
  logger.info('Scheduler module not available or not implemented yet');
}

// Then import routes
const { userRoutes, sessionRoutes } = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const b2bRoutes = require('./routes/b2b');

const currencyRoutes = require('./routes/currency');

// Create express app
const app = express();
const PORT = process.env.PORT || 5000;

// Track .env file last modified time
let envLastModified = 0;
const envPath = path.join(__dirname, '.env');

// Function to check if .env file has been modified
async function checkEnvFileChanges() {
  try {
    if (!fs.existsSync(envPath)) return false;
    
    const stats = fs.statSync(envPath);
    const mtime = stats.mtimeMs;
    
    if (mtime > envLastModified) {
      logger.info('.env file has been modified, reloading environment variables');
      require('dotenv').config({ override: true });
      envLastModified = mtime;
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking .env file changes:', error);
    return false;
  }
}

// Initialize data store with sample data if in development
if (process.env.NODE_ENV === 'development') {
}

// Function to sync settings from .env to database
async function syncSettingsFromEnv() {
  if (process.env.USE_DATABASE !== 'true') return false;
  
  try {
    const { Setting } = require('./models');
    
    // Bank prefix is no longer synced from .env - it comes from central bank instead
    
    // Sync bank name from .env
    if (process.env.BANK_NAME) {
      const [setting] = await Setting.findOrCreate({
        where: { name: 'bank_name' },
        defaults: { 
          value: process.env.BANK_NAME,
          description: 'Name of the bank'
        }
      });
      
      if (setting.value !== process.env.BANK_NAME) {
        await setting.update({ value: process.env.BANK_NAME });
        return true; // Indicate that a change was made
      }
    }
    
    logger.info('Environment settings synced to database');
    return false; // No changes made
  } catch (error) {
    logger.error('Failed to sync settings from .env to database:', error);
    return false;
  }
}

// Function to periodically check for environment changes
function setupEnvWatcher() {
  // Initial file mtime capture
  if (fs.existsSync(envPath)) {
    envLastModified = fs.statSync(envPath).mtimeMs;
  }
  
  // Check every minute for changes to .env
  const checkInterval = 60 * 1000; // 1 minute
  setInterval(async () => {
    const changed = await checkEnvFileChanges();
    if (changed) {
      logger.info('Environment variables updated, syncing with database');
      const settingsUpdated = await syncSettingsFromEnv();
      if (settingsUpdated) {
        logger.info('Database settings updated from environment changes');
      }
    }
  }, checkInterval);
}

// Serve static files from public directory
app.use(express.static('public'));

// Compression middleware - add before other middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// XSS Protection
const xssProtection = require('./middleware/xssProtection');
app.use(xssProtection.sanitizeAll);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, './openapi.yaml'));

// Swagger API docs setup
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// Routes
app.use('/users', userRoutes);
app.use('/sessions', sessionRoutes);
app.use('/accounts', accountRoutes);
app.use('/transfers', transactionRoutes);
app.use('/transactions', b2bRoutes);

app.use('/', currencyRoutes);

// JWKS endpoint for verifying digital signatures
app.get('/jwks.json', (req, res) => {
  try {
    const keyManager = require('./utils/keyManager');
    const jwks = keyManager.getJwks();
    res.status(200).json(jwks);
  } catch (error) {
    logger.error('Error serving JWKS:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to retrieve JWKS' });
  }
});

// Admin endpoint to force settings sync
app.post('/admin/sync-settings', async (req, res) => {
  try {
    // Reload .env file to get latest values
    require('dotenv').config();
    
    // Sync settings
    const changed = await syncSettingsFromEnv();
    
    res.status(200).json({
      message: changed ? 'Settings updated from environment' : 'No changes needed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error syncing settings:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to sync settings' });
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler middleware (should be last)
app.use(errorHandler);

// Database connection and sync
async function initializeApp() {
  try {
    // Initialize Redis first
    await initializeRedis();
    
    // Warm up cache with frequently accessed data
    await cacheService.warmUp();
    
    // Check if we should use database
    if (process.env.USE_DATABASE === 'true') {
      // Test database connection
      logger.info('Testing database connection...');
      const connected = await testConnection();
      
      if (!connected) {
        logger.error('Failed to connect to database. Exiting.');
        process.exit(1);
      }
      
      // Sync models with database - only use alter in development mode
      logger.info('Syncing database models...');
      const shouldAlter = process.env.NODE_ENV === 'development';
      await sequelize.sync({ alter: shouldAlter }); 
      logger.info(`Database sync complete (alter: ${shouldAlter})`);
      
      // Update bank prefix in database to match .env file
      logger.info('Checking bank prefix...');
      await DatabaseSync.syncBankPrefix();
    }
    
    // Setup .env file watcher to detect changes while app is running
    setupEnvWatcher();
    
    // Start scheduler for background tasks if available
    if (scheduler && typeof scheduler.start === 'function' && process.env.USE_SCHEDULER !== 'false') {
      logger.info('Starting scheduler for background tasks');
      scheduler.start();
    }
    
    startServer();
  } catch (error) {
    logger.error('Application initialization error:', { error: error.message, stack: error.stack });
    startServer();
  }
}

// Function to start the server
function startServer() {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API Documentation available at http://localhost:${PORT}/docs`);
  });
}

// Don't automatically start the application when testing
if (process.env.NODE_ENV !== 'test') {
  initializeApp();
}

// Export the app and scheduler for testing purposes
app.scheduler = scheduler;
module.exports = app;
