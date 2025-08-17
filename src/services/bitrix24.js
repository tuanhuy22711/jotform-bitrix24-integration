const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const tokenStore = require('../utils/tokenStore');
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

    // Load saved tokens on initialization
    this.loadSavedTokens();
  }

  /**
   * Load saved tokens from storage
   */
  loadSavedTokens() {
    const tokens = tokenStore.loadTokens();
    if (tokens) {
      logger.info('🔄 LOADING SAVED TOKENS INTO SERVICE', {
        domain: tokens.domain,
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        expiresAt: tokens.expiresAt
      });

      this.oauth.setTokens(tokens.accessToken, tokens.refreshToken);
      this.oauth.clientEndpoint = tokens.clientEndpoint;
      this.oauth.serverEndpoint = tokens.serverEndpoint;
      this.oauth.domain = tokens.domain;
    }
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
  async testConnection() {
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
   * Process installation event auth data
   * @param {Object} authData - Auth data from installation event
   * @returns {Object} Processed result
   */
  processInstallationAuth(authData) {
    const result = this.oauth.processInstallationAuth(authData);
    
    if (result.success) {
      // Save tokens to persistent storage
      const saved = tokenStore.saveTokens(result);
      
      if (saved) {
        logger.info('💾 TOKENS SAVED TO PERSISTENT STORAGE', {
          domain: result.domain,
          memberId: result.memberId
        });
      }
    }
    
    return result;
  }

  /**
   * Get OAuth2 authorization URL for Complete OAuth 2.0 Protocol
   * @param {string} userDomain - User's Bitrix24 domain
   * @param {string} state - Optional state parameter
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(userDomain = null, state = null) {
    if (userDomain) {
      return this.oauth.getUserAuthorizationUrl(userDomain, state);
    }
    return this.oauth.getAuthorizationUrl(null, state);
  }

  /**
   * Handle OAuth2 callback
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token exchange result
   */
  async handleOAuthCallback(code) {
    const result = await this.oauth.exchangeCodeForToken(code);
    
    if (result.success) {
      // Save tokens to persistent storage
      const saved = tokenStore.saveTokens(result);
      
      if (saved) {
        logger.info('💾 OAUTH TOKENS SAVED TO PERSISTENT STORAGE', {
          domain: result.domain,
          memberId: result.memberId
        });
      }
    }
    
    return result;
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
        COMMENTS: `Đã gửi qua Jotform vào ${new Date(contactData.submittedAt).toLocaleString('vi-VN')}\nSubmission ID: ${contactData.submissionId}`
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
   * Get contact list from Bitrix24 CRM
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Contact list result
   */
  async getContactList(options = {}) {
    try {
      const params = {
        select: options.select || ['ID', 'NAME', 'LAST_NAME', 'BIRTHDATE', 'PHONE', 'EMAIL'],
        filter: options.filter || {},
        order: options.order || { 'ID': 'DESC' },
        start: options.start || 0
      };

      logger.info('Getting contact list from Bitrix24', {
        selectFields: params.select.length,
        hasFilter: Object.keys(params.filter).length > 0,
        start: params.start
      });

      const result = await this.oauth.makeApiCall('crm.contact.list', params);

      if (result.success) {
        logger.info('Contact list retrieved successfully', {
          total: result.total,
          contactCount: result.result?.length || 0
        });

        return {
          success: true,
          contacts: result.result,
          total: result.total,
          message: 'Contact list retrieved successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error getting contact list', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get contact by ID from Bitrix24 CRM
   * @param {string|number} contactId - Contact ID
   * @returns {Promise<Object>} Contact result
   */
  async getContact(contactId) {
    try {
      logger.info('Getting contact from Bitrix24', { contactId });

      const result = await this.oauth.makeApiCall('crm.contact.get', {
        ID: contactId
      });

      if (result.success) {
        logger.info('Contact retrieved successfully', {
          contactId,
          contactName: `${result.result.NAME || ''} ${result.result.LAST_NAME || ''}`.trim()
        });

        return {
          success: true,
          contact: result.result,
          message: 'Contact retrieved successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error getting contact', {
        contactId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update contact in Bitrix24 CRM
   * @param {string|number} contactId - Contact ID
   * @param {Object} contactData - Contact data to update
   * @returns {Promise<Object>} Update result
   */
  async updateContact(contactId, contactData) {
    try {
      logger.info('Updating contact in Bitrix24', {
        contactId,
        fieldsToUpdate: Object.keys(contactData).length
      });

      const result = await this.oauth.makeApiCall('crm.contact.update', {
        ID: contactId,
        FIELDS: contactData
      });

      if (result.success) {
        logger.info('Contact updated successfully', { contactId });

        return {
          success: true,
          contactId: contactId,
          message: 'Contact updated successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error updating contact', {
        contactId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete contact from Bitrix24 CRM
   * @param {string|number} contactId - Contact ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteContact(contactId) {
    try {
      logger.info('Deleting contact from Bitrix24', { contactId });

      const result = await this.oauth.makeApiCall('crm.contact.delete', {
        ID: contactId
      });

      if (result.success) {
        logger.info('Contact deleted successfully', { contactId });

        return {
          success: true,
          contactId: contactId,
          message: 'Contact deleted successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error deleting contact', {
        contactId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get product list from Bitrix24 CRM
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Product list result
   */
  async getProductList(options = {}) {
    try {
      const params = {
        select: options.select || ['ID', 'NAME', 'PRICE', 'CURRENCY_ID', 'ACTIVE'],
        filter: options.filter || {},
        order: options.order || { 'ID': 'DESC' },
        start: options.start || 0
      };

      logger.info('Getting product list from Bitrix24', {
        selectFields: params.select.length,
        hasFilter: Object.keys(params.filter).length > 0,
        start: params.start
      });

      const result = await this.oauth.makeApiCall('crm.product.list', params);

      if (result.success) {
        logger.info('Product list retrieved successfully', {
          total: result.total,
          productCount: result.result?.length || 0
        });

        return {
          success: true,
          products: result.result,
          total: result.total,
          message: 'Product list retrieved successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error getting product list', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make generic API call to Bitrix24
   * @param {string} method - API method
   * @param {Object} params - API parameters
   * @returns {Promise<Object>} API result
   */
  async makeApiCall(method, params = {}) {
    try {
      logger.info('Making generic API call to Bitrix24', {
        method,
        paramCount: Object.keys(params).length
      });

      const result = await this.oauth.makeApiCall(method, params);

      if (result.success) {
        logger.info('Generic API call successful', {
          method,
          hasResult: !!result.result
        });

        return {
          success: true,
          result: result.result,
          total: result.total,
          time: result.time,
          message: 'API call successful'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }

    } catch (error) {
      logger.error('Error making generic API call', {
        method,
        error: error.message,
        stack: error.stack
      });

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
}

module.exports = Bitrix24Service;
