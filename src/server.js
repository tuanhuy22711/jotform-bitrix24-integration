const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const logger = require('./utils/logger');
const { requestLogger, errorHandler, notFound } = require('./middleware/common');

// Import routes
const healthRoutes = require('./routes/health');
const webhookRoutes = require('./routes/webhook');
const oauthRoutes = require('./routes/oauth');
const oauth2Routes = require('./routes/oauth2');
const installRoutes = require('./routes/install');
const apiRoutes = require('./routes/api');

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
    // Install routes (must be first for root path)
    this.app.use('/', installRoutes);
    
    // Health routes  
    this.app.use('/', healthRoutes);
    
    // OAuth routes (legacy)
    this.app.use('/oauth', oauthRoutes);
    
    // Complete OAuth2 routes
    this.app.use('/oauth2', oauth2Routes);
    
    // Webhook routes
    this.app.use('/webhook', webhookRoutes);
    
    // API routes
    this.app.use('/api', apiRoutes);
    
    // API information route
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'Jotform-Bitrix24 Integration API',
        version: '1.0.0',
        description: 'Simple API for integrating Jotform submissions with Bitrix24 CRM',
        endpoints: {
          install: ['GET /', 'POST /'],
          health: ['GET /health', 'GET /ping'],
          oauth: ['GET /oauth/authorize', 'GET /oauth/callback', 'GET /oauth/status'],
          oauth2: ['GET /oauth2/start', 'POST /oauth2/domain', 'GET /oauth2/callback', 'GET /oauth2/status'],
          webhook: ['POST /webhook/jotform'],
          api: ['GET /api/status', 'GET /api/test-token', 'GET /api/contacts', 'POST /api/bitrix24'],
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
📱 Install: http://localhost:${this.port}/?DOMAIN=xxx&PROTOCOL=1&LANG=vn&APP_SID=xxx
🔐 OAuth (Legacy): http://localhost:${this.port}/oauth/authorize
🔒 OAuth2 (Complete): http://localhost:${this.port}/oauth2/start?domain=yourcompany.bitrix24.com
🎯 Webhook: http://localhost:${this.port}/webhook/jotform
🔧 API: http://localhost:${this.port}/api/status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });
  }
}

module.exports = Server;

// Auto-start server when this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}
