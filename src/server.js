const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/config');
const logger = require('./utils/logger');
const WebhookController = require('./controllers/webhookController');
const {
  errorHandler,
  notFound,
  requestLogger,
  webhookRateLimiter,
  apiRateLimiter,
  corsOptions,
  securityHeaders,
  requestSizeLimiter,
  healthCheckBypass
} = require('./middleware');

class Server {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.webhookController = new WebhookController();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Health check bypass (should be first)
    this.app.use(healthCheckBypass);
    
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false
    }));
    
    this.app.use(securityHeaders);
    
    // CORS
    this.app.use(cors(corsOptions));
    
    // Request logging
    this.app.use(requestLogger);
    
    // Rate limiting
    this.app.use('/webhook', webhookRateLimiter);
    this.app.use('/api', apiRateLimiter);
    
    // Body parsing
    this.app.use(requestSizeLimiter);
    this.app.use(express.urlencoded({ extended: true }));
    
    // Trust proxy for rate limiting
    this.app.set('trust proxy', 1);
    
    logger.info('Middleware setup completed');
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Health check routes
    this.app.get('/health', this.webhookController.healthCheck.bind(this.webhookController));
    this.app.get('/ping', (req, res) => {
      res.status(200).json({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Webhook routes
    this.app.post('/webhook/jotform', this.webhookController.handleJotformWebhook.bind(this.webhookController));
    
    // Test routes (only in development)
    if (config.server.nodeEnv === 'development') {
      this.app.post('/webhook/test', this.webhookController.testWebhook.bind(this.webhookController));
      
      this.app.get('/test/jotform', async (req, res) => {
        try {
          const result = await this.webhookController.jotformService.validateConnection();
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      this.app.get('/test/bitrix24', async (req, res) => {
        try {
          const result = await this.webhookController.bitrix24Service.validateConnection();
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      logger.info('Development test routes enabled');
    }

    // API information route
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'Jotform-Bitrix24 Integration API',
        version: process.env.npm_package_version || '1.0.0',
        description: 'API for integrating Jotform submissions with Bitrix24 CRM',
        endpoints: {
          webhooks: [
            'POST /webhook/jotform - Handle Jotform submission webhooks'
          ],
          health: [
            'GET /health - Health check with service status',
            'GET /ping - Simple ping endpoint'
          ],
          info: [
            'GET /api/info - API information'
          ]
        },
        environment: config.server.nodeEnv,
        timestamp: new Date().toISOString()
      });
    });

    logger.info('Routes setup completed');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFound);
    
    // Error handler (must be last)
    this.app.use(errorHandler);
    
    logger.info('Error handling setup completed');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Validate configuration before starting
      await this.validateConfiguration();
      
      this.server = this.app.listen(this.port, () => {
        logger.info('Server started successfully', {
          port: this.port,
          env: config.server.nodeEnv,
          pid: process.pid,
          nodeVersion: process.version
        });
        
        console.log(`
🚀 Jotform-Bitrix24 Integration API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running on: http://localhost:${this.port}
🌍 Environment: ${config.server.nodeEnv}
📊 Health check: http://localhost:${this.port}/health
📋 API info: http://localhost:${this.port}/api/info
🎯 Webhook endpoint: http://localhost:${this.port}/webhook/jotform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
      });

      // Graceful shutdown handlers
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Validate configuration before starting
   */
  async validateConfiguration() {
    logger.info('Validating configuration...');
    
    const errors = [];
    
    // Check required environment variables
    if (!config.jotform.apiKey) {
      errors.push('JOTFORM_API_KEY is required');
    }
    
    if (!config.jotform.formId) {
      errors.push('JOTFORM_FORM_ID is required');
    }
    
    if (!config.bitrix24.restUrl) {
      errors.push('BITRIX24_REST_URL is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
    
    // Test API connections
    try {
      logger.info('Testing Jotform connection...');
      const jotformResult = await this.webhookController.jotformService.validateConnection();
      
      if (!jotformResult.success) {
        logger.warn('Jotform connection test failed', { error: jotformResult.error });
      } else {
        logger.info('Jotform connection test passed');
      }
    } catch (error) {
      logger.warn('Jotform connection test error', { error: error.message });
    }
    
    try {
      logger.info('Testing Bitrix24 connection...');
      const bitrix24Result = await this.webhookController.bitrix24Service.validateConnection();
      
      if (!bitrix24Result.success) {
        logger.warn('Bitrix24 connection test failed', { error: bitrix24Result.error });
      } else {
        logger.info('Bitrix24 connection test passed');
      }
    } catch (error) {
      logger.warn('Bitrix24 connection test error', { error: error.message });
    }
    
    logger.info('Configuration validation completed');
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            logger.error('Error during server shutdown', { error: err.message });
            process.exit(1);
          }
          
          logger.info('Server closed successfully');
          process.exit(0);
        });
        
        // Force shutdown after 30 seconds
        setTimeout(() => {
          logger.error('Force shutdown after timeout');
          process.exit(1);
        }, 30000);
      } else {
        process.exit(0);
      }
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason?.message || reason,
        promise: promise
      });
      process.exit(1);
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create and export server instance
const server = new Server();

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = server;
