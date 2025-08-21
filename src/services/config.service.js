/**
 * Configuration service for environment variables
 */
class ConfigService {
  /**
   * Get environment variable with optional default value
   */
  get(key, defaultValue) {
    const value = process.env[key];
    
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is not set`);
    }

    // Try to parse as number if defaultValue is number
    if (typeof defaultValue === 'number') {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a valid number`);
      }
      return parsed;
    }

    // Try to parse as boolean if defaultValue is boolean
    if (typeof defaultValue === 'boolean') {
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new Error(`Environment variable ${key} must be 'true' or 'false'`);
    }

    return value;
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return {
      port: this.get('PORT', 3000),
      nodeEnv: this.get('NODE_ENV', 'development'),
      rateLimitMax: this.get('API_RATE_LIMIT', 100),
      webhookSecret: this.get('WEBHOOK_SECRET', 'dev-secret-key')
    };
  }

  /**
   * Get Jotform configuration
   */
  getJotformConfig() {
    return {
      apiKey: this.get('JOTFORM_API_KEY'),
      formId: this.get('JOTFORM_FORM_ID'),
      apiUrl: this.get('JOTFORM_API_URL', 'https://api.jotform.com')
    };
  }

  /**
   * Get Bitrix24 configuration
   */
  getBitrix24Config() {
    return {
      clientId: this.get('BITRIX24_CLIENT_ID'),
      clientSecret: this.get('BITRIX24_CLIENT_SECRET'),
      domain: this.get('BITRIX24_DOMAIN'),
      redirectUri: this.get('BITRIX24_REDIRECT_URI'),
      restUrl: this.get('BITRIX24_REST_URL'),
      webhookUrl: this.get('BITRIX24_WEBHOOK_URL'),
      apiTimeout: this.get('BITRIX24_API_TIMEOUT', 10000),
      retryAttempts: this.get('BITRIX24_API_RETRY_ATTEMPTS', 3),
      retryDelay: this.get('BITRIX24_API_RETRY_DELAY', 1000)
    };
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig() {
    return {
      level: this.get('LOG_LEVEL', 'info'),
      file: this.get('LOG_FILE', 'logs/app.log'),
      maxFiles: 5,
      maxSize: '10m'
    };
  }

  /**
   * Validate all required configuration
   */
  validateConfig() {
    try {
      // Check required Jotform config
      this.getJotformConfig();
      
      // Check required Bitrix24 config
      this.getBitrix24Config();
      
      return true;
    } catch (error) {
      console.error('❌ Configuration validation failed:', error.message);
      return false;
    }
  }
}

module.exports = ConfigService;
