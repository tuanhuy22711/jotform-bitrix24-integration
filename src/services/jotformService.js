const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class JotformService {
  constructor() {
    this.apiKey = config.jotform.apiKey;
    this.baseUrl = config.jotform.apiUrl;
    this.formId = config.jotform.formId;
    
    // Setup axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Jotform API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Jotform API request error', { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Jotform API response', {
          status: response.status,
          url: response.config.url,
          responseType: response.headers['content-type']
        });
        return response;
      },
      (error) => {
        logger.error('Jotform API response error', {
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
   * Get form information
   * @param {string} formId - Jotform form ID
   * @returns {Promise<Object>} Form data
   */
  async getForm(formId = this.formId) {
    try {
      const startTime = Date.now();
      const response = await this.client.get(`/form/${formId}`);
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Jotform', `/form/${formId}`, 'GET', response.status, duration);
      
      if (response.data.responseCode === 200) {
        return {
          success: true,
          data: response.data.content
        };
      } else {
        throw new Error(`Jotform API error: ${response.data.message}`);
      }
    } catch (error) {
      logger.error('Failed to get form from Jotform', {
        formId,
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
   * Get form submissions
   * @param {string} formId - Jotform form ID
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise<Object>} Submissions data
   */
  async getSubmissions(formId = this.formId, options = {}) {
    try {
      const startTime = Date.now();
      const params = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        filter: options.filter || {},
        orderby: options.orderby || 'created_at'
      };
      
      const response = await this.client.get(`/form/${formId}/submissions`, { params });
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Jotform', `/form/${formId}/submissions`, 'GET', response.status, duration);
      
      if (response.data.responseCode === 200) {
        return {
          success: true,
          data: response.data.content,
          count: response.data.content.length
        };
      } else {
        throw new Error(`Jotform API error: ${response.data.message}`);
      }
    } catch (error) {
      logger.error('Failed to get submissions from Jotform', {
        formId,
        options,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get specific submission
   * @param {string} submissionId - Submission ID
   * @returns {Promise<Object>} Submission data
   */
  async getSubmission(submissionId) {
    try {
      const startTime = Date.now();
      const response = await this.client.get(`/submission/${submissionId}`);
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Jotform', `/submission/${submissionId}`, 'GET', response.status, duration);
      
      if (response.data.responseCode === 200) {
        return {
          success: true,
          data: response.data.content
        };
      } else {
        throw new Error(`Jotform API error: ${response.data.message}`);
      }
    } catch (error) {
      logger.error('Failed to get submission from Jotform', {
        submissionId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse submission data to extract contact information
   * @param {Object} submission - Raw submission data from Jotform
   * @returns {Object} Parsed contact data
   */
  parseSubmissionData(submission) {
    try {
      const answers = submission.answers || {};
      const contactData = {
        fullName: '',
        phone: '',
        email: '',
        submissionId: submission.id,
        submittedAt: submission.created_at || submission.updated_at
      };

      // Parse answers to extract contact information
      // Jotform answers are in format: { "3": { "name": "fullName", "answer": "John Doe" } }
      Object.values(answers).forEach(answer => {
        const fieldType = answer.type?.toLowerCase();
        const fieldName = answer.name?.toLowerCase();
        const value = answer.answer || answer.prettyFormat || '';

        // Map different field types and names to our contact data
        if (fieldType === 'control_fullname' || 
            fieldName?.includes('name') || 
            fieldName?.includes('fullname') ||
            answer.text?.toLowerCase().includes('name')) {
          contactData.fullName = value;
        } else if (fieldType === 'control_phone' || 
                   fieldName?.includes('phone') ||
                   answer.text?.toLowerCase().includes('phone')) {
          contactData.phone = value;
        } else if (fieldType === 'control_email' || 
                   fieldName?.includes('email') ||
                   answer.text?.toLowerCase().includes('email')) {
          contactData.email = value;
        }
      });

      // Log parsed data for debugging
      logger.info('Parsed submission data', {
        submissionId: contactData.submissionId,
        hasName: !!contactData.fullName,
        hasPhone: !!contactData.phone,
        hasEmail: !!contactData.email
      });

      return contactData;
    } catch (error) {
      logger.error('Failed to parse submission data', {
        submissionId: submission.id,
        error: error.message
      });
      
      throw new Error('Failed to parse submission data');
    }
  }

  /**
   * Validate API connection
   * @returns {Promise<Object>} Connection status
   */
  async validateConnection() {
    try {
      if (!this.apiKey || !this.formId) {
        return {
          success: false,
          error: 'Missing API key or Form ID'
        };
      }

      const result = await this.getForm();
      
      if (result.success) {
        logger.info('Jotform connection validated successfully', {
          formId: this.formId,
          formTitle: result.data.title
        });
        
        return {
          success: true,
          message: 'Jotform connection is working',
          formTitle: result.data.title
        };
      } else {
        return result;
      }
    } catch (error) {
      logger.error('Jotform connection validation failed', {
        error: error.message
      });
      
      return {
        success: false,
        error: 'Connection validation failed'
      };
    }
  }
}

module.exports = JotformService;
