const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const logger = require('./utils/logger');
const { requestLogger, errorHandler, notFound } = require('./middleware/common');

// Import routes
const healthRoutes = require('./routes/health');
const webhookRoutes = require('./routes/webhook');

class Server {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use(requestLogger);
  }

  setupRoutes() {
    // Health routes
    this.app.use('/', healthRoutes);
    
    // Webhook routes
    this.app.use('/webhook', webhookRoutes);
    
    // API information route
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'Jotform-Bitrix24 Integration API',
        version: '1.0.0',
        description: 'Simple API for integrating Jotform submissions with Bitrix24 CRM',
        endpoints: {
          health: ['GET /health', 'GET /ping'],
          webhook: ['POST /webhook/jotform'],
          test: ['GET /webhook/test']
        },
        timestamp: new Date().toISOString()
      });
    });
    
    // 404 handler
    this.app.use('*', notFound);
    
    // Error handler
    this.app.use(errorHandler);
  }

  start() {
    this.app.listen(this.port, () => {
      logger.info(`Server running on port ${this.port}`);
      logger.info('Environment:', process.env.NODE_ENV || 'development');
      
      console.log(`
🚀 Jotform-Bitrix24 Integration API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server: http://localhost:${this.port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 Health: http://localhost:${this.port}/health
🎯 Webhook: http://localhost:${this.port}/webhook/jotform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });
  }
}

module.exports = Server;
