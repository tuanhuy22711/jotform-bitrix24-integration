const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class Bitrix24Service {
  constructor() {
    this.webhookUrl = config.bitrix24.webhookUrl;
    this.restUrl = config.bitrix24.restUrl;
    this.fieldMapping = config.fieldMapping;
    
    // Setup axios instance
    this.client = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Bitrix24 API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          dataKeys: config.data ? Object.keys(config.data) : []
        });
        return config;
      },
      (error) => {
        logger.error('Bitrix24 API request error', { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Bitrix24 API response', {
          status: response.status,
          url: response.config.url,
          hasResult: !!response.data?.result
        });
        return response;
      },
      (error) => {
        logger.error('Bitrix24 API response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new contact in Bitrix24 CRM
   * @param {Object} contactData - Contact information
   * @returns {Promise<Object>} Creation result
   */
  async createContact(contactData) {
    try {
      const startTime = Date.now();
      
      // Map contact data to Bitrix24 fields
      const bitrixFields = this.mapContactFields(contactData);
      
      const url = `${this.restUrl}/crm.contact.add.json`;
      const payload = {
        fields: bitrixFields
      };
      
      logger.info('Creating contact in Bitrix24', {
        fullName: contactData.fullName,
        email: contactData.email,
        phone: contactData.phone,
        mappedFields: Object.keys(bitrixFields)
      });
      
      const response = await this.client.post(url, payload);
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Bitrix24', '/crm.contact.add', 'POST', response.status, duration);
      
      if (response.data && response.data.result) {
        const contactId = response.data.result;
        
        logger.info('Contact created successfully in Bitrix24', {
          contactId,
          fullName: contactData.fullName,
          submissionId: contactData.submissionId
        });
        
        return {
          success: true,
          contactId,
          data: response.data
        };
      } else {
        throw new Error(`Bitrix24 API error: ${response.data?.error_description || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Failed to create contact in Bitrix24', {
        contactData: {
          fullName: contactData.fullName,
          email: contactData.email,
          phone: contactData.phone
        },
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Update an existing contact in Bitrix24
   * @param {number} contactId - Contact ID in Bitrix24
   * @param {Object} contactData - Updated contact information
   * @returns {Promise<Object>} Update result
   */
  async updateContact(contactId, contactData) {
    try {
      const startTime = Date.now();
      
      const bitrixFields = this.mapContactFields(contactData);
      
      const url = `${this.restUrl}/crm.contact.update.json`;
      const payload = {
        id: contactId,
        fields: bitrixFields
      };
      
      logger.info('Updating contact in Bitrix24', {
        contactId,
        fullName: contactData.fullName,
        mappedFields: Object.keys(bitrixFields)
      });
      
      const response = await this.client.post(url, payload);
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Bitrix24', '/crm.contact.update', 'POST', response.status, duration);
      
      if (response.data && response.data.result) {
        logger.info('Contact updated successfully in Bitrix24', {
          contactId,
          fullName: contactData.fullName
        });
        
        return {
          success: true,
          contactId,
          data: response.data
        };
      } else {
        throw new Error(`Bitrix24 API error: ${response.data?.error_description || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Failed to update contact in Bitrix24', {
        contactId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search for existing contacts by email or phone
   * @param {Object} searchData - Search criteria
   * @returns {Promise<Object>} Search results
   */
  async searchContact(searchData) {
    try {
      const startTime = Date.now();
      
      const filter = {};
      
      if (searchData.email) {
        filter.EMAIL = searchData.email;
      }
      
      if (searchData.phone) {
        filter.PHONE = searchData.phone;
      }
      
      const url = `${this.restUrl}/crm.contact.list.json`;
      const payload = {
        filter,
        select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL', 'PHONE']
      };
      
      logger.info('Searching for contact in Bitrix24', {
        email: searchData.email,
        phone: searchData.phone
      });
      
      const response = await this.client.post(url, payload);
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Bitrix24', '/crm.contact.list', 'POST', response.status, duration);
      
      if (response.data && Array.isArray(response.data.result)) {
        const contacts = response.data.result;
        
        logger.info('Contact search completed', {
          foundCount: contacts.length,
          email: searchData.email,
          phone: searchData.phone
        });
        
        return {
          success: true,
          found: contacts.length > 0,
          contacts,
          count: contacts.length
        };
      } else {
        throw new Error(`Bitrix24 API error: ${response.data?.error_description || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Failed to search contact in Bitrix24', {
        searchData,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a lead in Bitrix24 CRM
   * @param {Object} contactData - Contact information
   * @returns {Promise<Object>} Creation result
   */
  async createLead(contactData) {
    try {
      const startTime = Date.now();
      
      const bitrixFields = {
        TITLE: `Lead from Jotform - ${contactData.fullName}`,
        NAME: this.extractFirstName(contactData.fullName),
        LAST_NAME: this.extractLastName(contactData.fullName),
        SOURCE_ID: 'WEB',
        STATUS_ID: 'NEW',
        COMMENTS: `Submitted via Jotform on ${new Date(contactData.submittedAt).toLocaleString()}\nSubmission ID: ${contactData.submissionId}`
      };
      
      // Add contact methods
      if (contactData.email) {
        bitrixFields.EMAIL = [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }];
      }
      
      if (contactData.phone) {
        bitrixFields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
      }
      
      const url = `${this.restUrl}/crm.lead.add.json`;
      const payload = { fields: bitrixFields };
      
      logger.info('Creating lead in Bitrix24', {
        title: bitrixFields.TITLE,
        fullName: contactData.fullName
      });
      
      const response = await this.client.post(url, payload);
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Bitrix24', '/crm.lead.add', 'POST', response.status, duration);
      
      if (response.data && response.data.result) {
        const leadId = response.data.result;
        
        logger.info('Lead created successfully in Bitrix24', {
          leadId,
          fullName: contactData.fullName
        });
        
        return {
          success: true,
          leadId,
          data: response.data
        };
      } else {
        throw new Error(`Bitrix24 API error: ${response.data?.error_description || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Failed to create lead in Bitrix24', {
        contactData: {
          fullName: contactData.fullName,
          email: contactData.email
        },
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Map contact data to Bitrix24 field format
   * @param {Object} contactData - Contact information
   * @returns {Object} Mapped Bitrix24 fields
   */
  mapContactFields(contactData) {
    const fields = {
      NAME: this.extractFirstName(contactData.fullName),
      LAST_NAME: this.extractLastName(contactData.fullName),
      SOURCE_ID: 'WEB',
      COMMENTS: `Submitted via Jotform on ${new Date(contactData.submittedAt).toLocaleString()}\nSubmission ID: ${contactData.submissionId}`
    };
    
    // Add contact methods array format
    if (contactData.email) {
      fields.EMAIL = [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }];
    }
    
    if (contactData.phone) {
      fields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
    }
    
    return fields;
  }

  /**
   * Extract first name from full name
   * @param {string} fullName - Full name string
   * @returns {string} First name
   */
  extractFirstName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts[0] || '';
  }

  /**
   * Extract last name from full name
   * @param {string} fullName - Full name string
   * @returns {string} Last name
   */
  extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.slice(1).join(' ') || '';
  }

  /**
   * Validate API connection
   * @returns {Promise<Object>} Connection status
   */
  async validateConnection() {
    try {
      if (!this.restUrl) {
        return {
          success: false,
          error: 'Missing REST URL'
        };
      }

      const url = `${this.restUrl}/crm.contact.fields.json`;
      const response = await this.client.get(url);
      
      if (response.data && response.data.result) {
        logger.info('Bitrix24 connection validated successfully');
        
        return {
          success: true,
          message: 'Bitrix24 connection is working',
          availableFields: Object.keys(response.data.result).length
        };
      } else {
        return {
          success: false,
          error: 'Invalid API response'
        };
      }
    } catch (error) {
      logger.error('Bitrix24 connection validation failed', {
        error: error.message
      });
      
      return {
        success: false,
        error: 'Connection validation failed'
      };
    }
  }
}

module.exports = Bitrix24Service;
