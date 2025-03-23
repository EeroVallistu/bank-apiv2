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
