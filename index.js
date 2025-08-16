const Server = require('./src/server');
const logger = require('./src/utils/logger');

// Create and start server
const server = new Server();

// Start server
server.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
