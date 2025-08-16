const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const Bitrix24OAuth = require('./bitrix24OAuth');

class Bitrix24Service {
  constructor() {
    this.oauth = new Bitrix24OAuth();
    this.domain = config.bitrix24.domain;
    this.timeout = config.bitrix24.timeout;
    this.retryAttempts = config.bitrix24.retryAttempts;
    this.retryDelay = config.bitrix24.retryDelay;
    
    // Legacy webhook client for fallback
    this.legacyClient = axios.create({
      baseURL: config.bitrix24.restUrl,
      timeout: this.timeout
    });
  }

  /**
   * Create a new lead in Bitrix24 CRM
   * @param {Object} contactData - Contact information
   * @returns {Promise<Object>} Creation result
   */
  async createLead(contactData) {
    try {
      const leadData = {
        fields: {
          TITLE: `Jotform Lead: ${contactData.fullName || 'Unknown'}`,
          NAME: this.extractFirstName(contactData.fullName),
          LAST_NAME: this.extractLastName(contactData.fullName),
          SOURCE_ID: 'WEBFORM',
          STATUS_ID: 'NEW',
          SOURCE_DESCRIPTION: `Jotform Submission ID: ${contactData.submissionId}`,
          COMMENTS: `Lead created from Jotform submission\nSubmission ID: ${contactData.submissionId}\nSubmitted at: ${contactData.submittedAt}`,
          ASSIGNED_BY_ID: 1,
          OPENED: 'Y'
        }
      };

      // Add email if available
      if (contactData.email) {
        leadData.fields.EMAIL = [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }];
      }

      // Add phone if available
      if (contactData.phone) {
        leadData.fields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
      }

      logger.info('Creating Bitrix24 lead', {
        submissionId: contactData.submissionId,
        leadTitle: leadData.fields.TITLE,
        hasName: !!contactData.fullName,
        hasEmail: !!contactData.email,
        hasPhone: !!contactData.phone
      });

      // Try OAuth2 first, then fallback to legacy webhook
      let result = await this.oauth.makeApiCall('crm.lead.add', leadData);

      if (!result.success && config.bitrix24.restUrl) {
        logger.warn('OAuth2 failed, trying legacy webhook', {
          error: result.error
        });
        result = await this.createLeadLegacy(contactData);
      }

      if (result.success) {
        logger.info('Lead created successfully in Bitrix24', {
          leadId: result.result || result.leadId,
          submissionId: contactData.submissionId,
          method: result.result ? 'OAuth2' : 'Legacy'
        });

        return {
          success: true,
          leadId: result.result || result.leadId,
          message: 'Lead created successfully'
        };
      } else {
        logger.error('Failed to create lead in Bitrix24', {
          error: result.error,
          details: result.details,
          submissionId: contactData.submissionId
        });

        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error creating Bitrix24 lead', {
        error: error.message,
        submissionId: contactData.submissionId,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

/**
 * Test connection to Bitrix24 API
 * @returns {Promise<Object>} Connection test result
 */
async function testConnection() {
  try {
    logger.info('Testing Bitrix24 connection via OAuth2');
    
    // Try OAuth2 first
    let result = await this.oauth.testConnection();
    
    if (!result.success && config.bitrix24.restUrl) {
      logger.warn('OAuth2 test failed, trying legacy webhook');
      result = await this.testConnectionLegacy();
    }
    
    if (result.success) {
      logger.info('Bitrix24 connection test successful', {
        user: result.user?.NAME || 'Unknown'
      });
      
      return {
        success: true,
        message: `Connected to Bitrix24 as ${result.user?.NAME || 'Unknown User'}`,
        user: result.user
      };
    } else {
      logger.warn('Bitrix24 connection test failed', {
        error: result.error,
        message: result.message
      });
      
      return {
        success: false,
        error: result.error,
        message: result.message
      };
    }

  } catch (error) {
    logger.error('Bitrix24 connection test error', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message,
      message: 'Connection test failed'
    };
  }
}

/**
 * Get OAuth2 authorization URL
 * @returns {string} Authorization URL
 */
getAuthorizationUrl() {
  return this.oauth.getAuthorizationUrl();
}

/**
 * Handle OAuth2 callback
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} Token exchange result
 */
async handleOAuthCallback(code) {
  return await this.oauth.exchangeCodeForToken(code);
}

/**
 * Set access token manually
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
setTokens(accessToken, refreshToken = null) {
  this.oauth.setTokens(accessToken, refreshToken);
}

/**
 * Get current access token
 * @returns {string|null} Access token
 */
getAccessToken() {
  return this.oauth.getAccessToken();
}

/**
 * Legacy webhook support (fallback method)
 * @param {Object} contactData - Contact information
 * @returns {Promise<Object>} Creation result
 */
async createLeadLegacy(contactData) {
  try {
    if (!config.bitrix24.restUrl) {
      throw new Error('No legacy webhook URL configured');
    }

    const leadFields = {
      TITLE: `Lead từ Jotform - ${contactData.fullName}`,
      NAME: this.extractFirstName(contactData.fullName),
      LAST_NAME: this.extractLastName(contactData.fullName),
      SOURCE_ID: 'WEB',
      STATUS_ID: 'NEW',
      COMMENTS: `Đã gửi qua Jotform vào ${new Date(contactData.submittedAt).toLocaleString('vi-VN')}
Submission ID: ${contactData.submissionId}`
    };

    // Add email
    if (contactData.email) {
      leadFields.EMAIL = [{
        VALUE: contactData.email,
        VALUE_TYPE: 'WORK'
      }];
    }

    // Add phone
    if (contactData.phone) {
      leadFields.PHONE = [{
        VALUE: contactData.phone,
        VALUE_TYPE: 'WORK'
      }];
    }

    logger.info('Creating lead via legacy webhook', {
      url: config.bitrix24.restUrl,
      submissionId: contactData.submissionId
    });

    const response = await this.legacyClient.post('crm.lead.add.json', {
      FIELDS: leadFields
    });

    if (response.data && response.data.result) {
      return {
        success: true,
        leadId: response.data.result,
        message: 'Lead created successfully via legacy webhook'
      };
    } else {
      return {
        success: false,
        error: response.data?.error_description || 'Unknown error',
        details: response.data
      };
    }

  } catch (error) {
    logger.error('Legacy webhook lead creation failed', {
      error: error.message,
      submissionId: contactData.submissionId
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Legacy connection test
 * @returns {Promise<Object>} Test result
 */
async testConnectionLegacy() {
  try {
    const response = await this.legacyClient.get('crm.lead.fields.json');
    
    if (response.data && response.data.result) {
      return {
        success: true,
        message: 'Legacy Bitrix24 connection is working'
      };
    } else {
      return {
        success: false,
        error: response.data?.error_description || 'Unknown error'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract first name from full name
 * @param {string} fullName - Full name
 * @returns {string} First name
 */
extractFirstName(fullName) {
  if (!fullName) return '';
  return fullName.split(' ')[0] || '';
}

/**
 * Extract last name from full name
 * @param {string} fullName - Full name
 * @returns {string} Last name
 */
extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

module.exports = Bitrix24Service;

/**
 * Lấy tên đầu từ họ tên đầy đủ
 */
function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[0] || '';
}

/**
 * Lấy họ từ họ tên đầy đủ
 */
function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts.slice(1).join(' ') || '';
}

module.exports = {
  createLead,
  testConnection
};
