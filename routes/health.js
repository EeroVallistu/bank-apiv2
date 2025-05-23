const express = require('express');
const { testConnection } = require('../models/database');
const router = express.Router();

/**
 * Health check endpoints for monitoring and load balancers
 */

// Basic health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check with dependencies
router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {}
  };

  // Database connectivity check
  try {
    await testConnection();
    health.checks.database = { status: 'healthy' };
  } catch (error) {
    health.checks.database = { 
      status: 'unhealthy', 
      error: error.message 
    };
    health.status = 'unhealthy';
  }

  // Memory usage check
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed < 100 * 1024 * 1024 ? 'healthy' : 'warning', // 100MB threshold
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  };

  // Environment check
  health.checks.environment = {
    status: 'healthy',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    await testConnection();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

module.exports = router;
