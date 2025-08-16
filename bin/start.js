#!/usr/bin/env node

/**
 * Jotform-Bitrix24 Integration API
 * Main entry point for the application
 */

const server = require('../src/server');
const logger = require('../src/utils/logger');

// Set process title
process.title = 'jotform-bitrix24-api';

// Display startup banner
console.log(`
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🔗 Jotform-Bitrix24 Integration API                      │
│                                                             │
│   📋 Automatically sync form submissions to CRM            │
│   🚀 Starting server...                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
`);

// Start the server
server.start().catch((error) => {
  logger.error('Application startup failed', {
    error: error.message,
    stack: error.stack
  });
  
  console.error('\n❌ Failed to start application:');
  console.error(error.message);
  console.error('\nPlease check your configuration and logs for more details.');
  
  process.exit(1);
});
