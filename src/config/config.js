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
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL,
    restUrl: process.env.BITRIX24_REST_URL || process.env.BITRIX24_WEBHOOK_URL,
    domain: process.env.BITRIX24_DOMAIN,
    accessToken: process.env.BITRIX24_ACCESS_TOKEN,
    endpoints: {
      contactAdd: '/crm.contact.add.json',
      contactList: '/crm.contact.list.json',
      contactGet: '/crm.contact.get.json'
    }
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
    'JOTFORM_FORM_ID': config.jotform.formId,
    'BITRIX24_WEBHOOK_URL': config.bitrix24.webhookUrl
  };

  const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing required environment variables: ${missing.join(', ')}`);
    console.warn('Please check your .env file. Using development defaults where possible.');
  }
};

// Validate configuration on module load
validateConfig();

module.exports = config;
