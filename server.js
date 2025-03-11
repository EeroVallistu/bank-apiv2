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

// Import in-memory data store
const dataStore = require('./models/inMemoryStore');

// Then import routes
const { userRoutes, sessionRoutes } = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const b2bRoutes = require('./routes/b2b');
const infoRoute = require('./routes/info');

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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});

// Apply rate limiting to all requests
app.use(apiLimiter);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5000',                  // Local development
    'https://bank.eerovallistu.site',        // Production domain
    'http://bank.eerovallistu.site'          // Production domain HTTP
  ],
  credentials: true,                         // Allow credentials (cookies, auth headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors()); // Enable pre-flight for all routes

app.use(express.json());

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API status endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'API is operational',
    timestamp: new Date().toISOString()
  });
});

// Configure Express to trust proxy headers
// This is needed because we're behind Nginx
app.set('trust proxy', 1);

// Apply API routes
app.use('/users', userRoutes);
app.use('/sessions', sessionRoutes);
app.use('/accounts', accountRoutes);
app.use('/transfers', transactionRoutes);
app.use('/transactions', b2bRoutes);  // Mount at /transactions for b2b endpoint
app.use('/transfers', b2bRoutes);     // Keep for backward compatibility

// Add bank info route
app.use('/bank-info', infoRoute);

// Make sure this endpoint is accessible at the correct URL
// It needs to match the URL registered with the central bank
app.get('/jwks.json', cache('5 minutes'), (req, res) => {
  try {
    const keyManager = require('./utils/keyManager');
    // Ensure keys exist
    keyManager.ensureKeysExist();
    // Get JWKS representation
    const jwks = keyManager.getJwks();
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json(jwks);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving JWKS',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Try making a test request to /health endpoint');
  console.log(`API documentation available at http://localhost:${PORT}/docs`);
});

module.exports = app; // Export for testing
