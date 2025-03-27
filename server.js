require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const scheduler = require('./utils/scheduler');

// Import middleware
const cache = require('./middleware/cache');
const errorHandler = require('./middleware/errorHandler');

// Database connection
const { sequelize, testConnection } = require('./models/database');

// Import in-memory data store
const dataStore = require('./models/inMemoryStore');

// Then import routes
const { userRoutes, sessionRoutes } = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const b2bRoutes = require('./routes/b2b');
const infoRoute = require('./routes/info');
const currencyRoutes = require('./routes/currency');

// Create express app
const app = express();
const PORT = process.env.PORT || 5000;

// Initialize data store with sample data if in development
if (process.env.NODE_ENV === 'development') {
}

// Function to sync settings from .env to database
async function syncSettingsFromEnv() {
  if (process.env.USE_DATABASE !== 'true') return;
  
  try {
    const { Setting } = require('./models');
    
    // Sync bank prefix from .env
    if (process.env.BANK_PREFIX) {
      const [setting] = await Setting.findOrCreate({
        where: { name: 'bank_prefix' },
        defaults: { 
          value: process.env.BANK_PREFIX,
          description: 'Bank prefix for account numbers'
        }
      });
      
      // If existing value is different from .env, update it
      if (setting.value !== process.env.BANK_PREFIX) {
        console.log(`Updating bank prefix from ${setting.value} to ${process.env.BANK_PREFIX}`);
        await setting.update({ value: process.env.BANK_PREFIX });
        return true; // Indicate that a change was made
      }
    }
    
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
      }
    }
    
    console.log('Environment settings synced to database');
    return false; // No changes made
  } catch (error) {
    console.error('Failed to sync settings from .env to database:', error);
    return false;
  }
}

// Serve static files from public directory
app.use(express.static('public'));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is operational',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/users', userRoutes);
app.use('/sessions', sessionRoutes);
app.use('/accounts', accountRoutes);
app.use('/transfers', transactionRoutes);
app.use('/transactions', b2bRoutes);
app.use('/bank-info', infoRoute);
app.use('/', currencyRoutes);

// JWKS endpoint for verifying digital signatures
app.get('/jwks.json', (req, res) => {
  try {
    const keyManager = require('./utils/keyManager');
    const jwks = keyManager.getJwks();
    res.status(200).json(jwks);
  } catch (error) {
    console.error('Error serving JWKS:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve JWKS'
    });
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
      status: 'success',
      message: changed ? 'Settings updated from environment' : 'No changes needed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync settings'
    });
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

// Error handler middleware (should be last)
app.use(errorHandler);

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/docs`);
  
  // Test database connection if enabled
  if (process.env.USE_DATABASE === 'true') {
    try {
      console.log('Testing database connection...');
      const connected = await testConnection();
      
      if (connected) {
        console.log('Syncing database models...');
        // Sync all models with the database
        // In production, you might want to use migration tools instead
        await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
        console.log('Database sync complete');
        
        // Sync settings from .env to database
        await syncSettingsFromEnv();
        
        // Set up periodic check for env changes (every 5 minutes)
        setInterval(async () => {
          // Reload .env file to get latest values
          require('dotenv').config();
          await syncSettingsFromEnv();
        }, 5 * 60 * 1000);
      } else {
        console.error('Failed to connect to database. Falling back to in-memory store.');
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      console.log('Using in-memory data store as fallback.');
    }
  } else {
    console.log('Using in-memory data store (database connection disabled).');
  }
  
  // Start scheduler for background tasks
  scheduler.start();
});

module.exports = app;
