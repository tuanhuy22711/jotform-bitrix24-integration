require('dotenv').config();
const ServiceContainer = require('./services/service-container');

// Initialize service container
const container = ServiceContainer.getInstance();

console.log('🚀 Jotform-Bitrix24 Integration started with new architecture');
console.log('✅ Services loaded:', container.getAllServices());

// Export container for use in other modules
module.exports = { container };
