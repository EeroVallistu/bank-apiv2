require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import middleware
const cache = require('./middleware/cache');
const errorHandler = require('./middleware/errorHandler');

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
  dataStore.initWithSampleData();
}

// Serve static files from public directory
app.use(express.static('public'));

// Security middleware
app.use(helmet());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.'
  }
});
app.use(limiter);

// CORS middleware
app.use(cors());

// Parse JSON request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load and serve Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, './openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
app.use('/users', userRoutes);
app.use('/sessions', sessionRoutes);
app.use('/accounts', accountRoutes);
app.use('/transfers', transactionRoutes);
app.use('/transactions', b2bRoutes);
app.use('/bank-info', infoRoute);
app.use('/', currencyRoutes);

// JWKS endpoint for other banks
app.get('/jwks.json', (req, res) => {
  try {
    const keyManager = require('./utils/keyManager');
    res.json(keyManager.getJwks());
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'API is operational',
    timestamp: new Date()
  });
});

// 404 handler - this runs if no route matches
app.use((req, res, next) => {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.status = 404;
  err.code = 'NOT_FOUND';
  next(err);
});

// Global error handler - must be last middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
