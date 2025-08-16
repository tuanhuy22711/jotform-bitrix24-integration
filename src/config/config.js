require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    rateLimitMax: parseInt(process.env.API_RATE_LIMIT) || 100,
    webhookSecret: process.env.WEBHOOK_SECRET || 'dev-secret-key'
  },

  // Jotform Configuration
  jotform: {
    apiKey: process.env.JOTFORM_API_KEY,
    formId: process.env.JOTFORM_FORM_ID,
    apiUrl: process.env.JOTFORM_API_URL || 'https://api.jotform.com',
    endpoints: {
      form: '/form/{formID}',
      submissions: '/form/{formID}/submissions',
      submission: '/submission/{submissionID}'
    }
  },

  // Bitrix24 Configuration
  bitrix24: {
    // OAuth2 App Configuration
    clientId: process.env.BITRIX24_CLIENT_ID || 'local.68a050ddaec1b3.43408198',
    clientSecret: process.env.BITRIX24_CLIENT_SECRET || 'qDLrdWyYY02LA3FVMtMg6aH3g5fF7w0RDgburwMZ3YzsIqloV2',
    
    // Domain and URLs
    domain: process.env.BITRIX24_DOMAIN || 'b24-7woulk.bitrix24.vn',
    redirectUri: process.env.BITRIX24_REDIRECT_URI || 'https://mart-guitars-educated-idea.trycloudflare.com/oauth/callback',
    
    // Legacy webhook support (fallback)
    restUrl: process.env.BITRIX24_REST_URL || process.env.BITRIX24_WEBHOOK_URL || 'https://b24-7woulk.bitrix24.vn/rest/1/rg1j0gwz9z74hdqe/',
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL || process.env.BITRIX24_REST_URL || 'https://b24-7woulk.bitrix24.vn/rest/1/rg1j0gwz9z74hdqe/',
    
    // API Configuration
    timeout: parseInt(process.env.BITRIX24_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.BITRIX24_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.BITRIX24_RETRY_DELAY) || 1000,
    
    // Access Token Storage (will be obtained via OAuth2)
    accessToken: process.env.BITRIX24_ACCESS_TOKEN || null,
    refreshToken: process.env.BITRIX24_REFRESH_TOKEN || null
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxFiles: 5,
    maxSize: '10m'
  },

  // Field Mapping
  fieldMapping: {
    jotformToBitrix24: {
      fullName: 'NAME',
      phone: 'PHONE',
      email: 'EMAIL'
    }
  }
};

// Validation
const validateConfig = () => {
  const required = {
    'JOTFORM_API_KEY': config.jotform.apiKey,
    'JOTFORM_FORM_ID': config.jotform.formId
  };

  // Only require webhook URL if no OAuth2 config
  if (!config.bitrix24.clientId || !config.bitrix24.clientSecret) {
    required['BITRIX24_WEBHOOK_URL'] = config.bitrix24.webhookUrl;
  }

  const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing required environment variables: ${missing.join(', ')}`);
    console.warn('Please check your .env file. Using development defaults where possible.');
  }

  // Show current config in development
  if (config.server.nodeEnv === 'development') {
    console.log('📋 Configuration loaded:');
    console.log(`   Server: http://localhost:${config.server.port}`);
    console.log(`   Bitrix24 Domain: ${config.bitrix24.domain}`);
    console.log(`   OAuth2 Client ID: ${config.bitrix24.clientId ? 'Configured' : 'Missing'}`);
    console.log(`   Legacy Webhook: ${config.bitrix24.restUrl ? 'Configured' : 'Missing'}`);
  }
};

// Validate configuration on module load
validateConfig();

module.exports = config;
