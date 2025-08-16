const express = require('express');
const { testConnection } = require('../services/bitrix24');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    logger.info('Health check requested');
    
    // Test Bitrix24 connection
    const bitrix24Status = await testConnection();
    
    const response = {
      status: bitrix24Status.success ? 'healthy' : 'partial',
      timestamp: new Date().toISOString(),
      services: {
        bitrix24: {
          status: bitrix24Status.success ? 'up' : 'down',
          message: bitrix24Status.message || bitrix24Status.error
        }
      }
    };
    
    const statusCode = bitrix24Status.success ? 200 : 503;
    return res.status(statusCode).json(response);
    
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /ping
 * Simple ping endpoint
 */
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
