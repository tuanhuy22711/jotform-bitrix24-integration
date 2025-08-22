require('dotenv').config();
const ServiceContainer = require('./services/service-container');

// Initialize service container asynchronously
async function initializeApp() {
  try {
    const container = ServiceContainer.getInstance();
    await container.initializeServices();
    
    console.log('🚀 Jotform-Bitrix24 Integration started with new architecture');
    console.log('✅ Services loaded:', container.getAllServices());
    
    // Export container for use in other modules
    module.exports = { container };
  } catch (error) {
    console.error('❌ Failed to initialize application:', error.message);
    process.exit(1);
  }
}

// Start initialization
initializeApp();
