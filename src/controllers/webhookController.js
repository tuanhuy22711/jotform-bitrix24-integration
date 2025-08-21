const JotformService = require('../services/jotformService');
const { ServiceContainer } = require('../services/service-container');
const logger = require('../utils/logger');
const crypto = require('crypto');

class WebhookController {
  constructor() {
    this.jotformService = new JotformService();
    const container = ServiceContainer.getInstance();
    this.bitrix24Service = container.getBitrix24Service();
  }

  /**
   * Handle Jotform webhook submissions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleJotformWebhook(req, res) {
    const startTime = Date.now();
    
    try {
      // Log chi tiết toàn bộ request
      logger.info('=== WEBHOOK REQUEST DEBUG ===', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        submissionID: req.body.submissionID,
        hasRawRequest: !!req.body.rawRequest,
        contentType: req.get('Content-Type')
      });
      
      // Lấy submission ID trực tiếp từ req.body
      const submissionId = req.body.submissionID;
      
      // Parse rawRequest để lấy form data
      let formData = {};
      if (req.body.rawRequest) {
        try {
          formData = JSON.parse(req.body.rawRequest);
          logger.info('=== PARSED FORM DATA ===', {
            submissionId,
            formData,
            hasQ3Name: !!formData.q3_name,
            hasQ4Phone: !!formData.q4_phoneNumber,
            hasQ5Email: !!formData.q5_email
          });
        } catch (parseError) {
          logger.error('Failed to parse rawRequest JSON', {
            rawRequest: req.body.rawRequest,
            error: parseError.message
          });
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON in rawRequest field'
          });
        }
      }
      
      if (!submissionId) {
        logger.error('Missing submission ID in webhook', { 
          body: req.body,
          bodyKeys: Object.keys(req.body || {})
        });
        return res.status(400).json({
          success: false,
          error: 'Missing submission ID'
        });
      }

      logger.info('Processing Jotform webhook', { submissionId });

      // Parse contact data trực tiếp từ form data thay vì call API
      const contactData = this.parseJotformData(formData, submissionId);
      
      logger.info('=== CONTACT DATA PARSED ===', {
        submissionId,
        contactData,
        hasFullName: !!contactData.fullName,
        hasEmail: !!contactData.email,
        hasPhone: !!contactData.phone
      });
      
      if (!contactData.fullName && !contactData.email && !contactData.phone) {
        logger.warn('No valid contact data found in submission', {
          submissionId,
          contactData,
          formData
        });
        
        return res.status(400).json({
          success: false,
          error: 'No valid contact data found'
        });
      }

      // Process contact in Bitrix24
      const bitrixResult = await this.processContactInBitrix24(contactData);
      
      const duration = Date.now() - startTime;
      
      if (bitrixResult.success) {
        logger.info('Webhook processed successfully', {
          submissionId,
          leadId: bitrixResult.leadId,
          duration
        });
        
        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully - Lead created in Bitrix24',
          data: {
            submissionId,
            leadId: bitrixResult.leadId,
            processingTime: duration
          }
        });
      } else {
        logger.error('Failed to process contact in Bitrix24', {
          submissionId,
          error: bitrixResult.error,
          duration
        });
        
        return res.status(500).json({
          success: false,
          error: 'Failed to create lead in Bitrix24',
          details: bitrixResult.error
        });
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Webhook processing error', {
        error: error.message,
        stack: error.stack,
        body: req.body,
        duration
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Process contact in Bitrix24 CRM
   * @param {Object} contactData - Contact information
   * @returns {Promise<Object>} Processing result
   */
  async processContactInBitrix24(contactData) {
    try {
      let leadId = null;

      // Tạo lead trong Bitrix24 (đơn giản và hiệu quả)
      logger.info('Creating lead in Bitrix24 for submission', {
        submissionId: contactData.submissionId,
        fullName: contactData.fullName,
        email: contactData.email,
        phone: contactData.phone
      });

      const leadResult = await this.bitrix24Service.createLead(contactData);
      
      if (leadResult.success) {
        leadId = leadResult.leadId;
        logger.info('Lead created successfully', { 
          leadId, 
          submissionId: contactData.submissionId,
          fullName: contactData.fullName
        });
        
        return {
          success: true,
          leadId,
          message: 'Lead created successfully in Bitrix24'
        };
      } else {
        logger.error('Failed to create lead', {
          submissionId: contactData.submissionId,
          error: leadResult.error,
          details: leadResult.details
        });
        
        return {
          success: false,
          error: leadResult.error,
          details: leadResult.details
        };
      }

    } catch (error) {
      logger.error('Error processing contact in Bitrix24', {
        error: error.message,
        submissionId: contactData.submissionId,
        contactData: {
          fullName: contactData.fullName,
          email: contactData.email,
          phone: contactData.phone
        }
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate webhook payload structure
   * @param {Object} payload - Webhook payload
   * @returns {Object} Validation result
   */
  validateWebhookPayload(payload) {
    const errors = [];
    
    if (!payload) {
      errors.push('Empty payload');
      return { isValid: false, errors };
    }
    
    // For Jotform, we don't require submissionID in the form data
    // as it comes in the top-level webhook payload
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify webhook signature (if Jotform provides one)
   * @param {string} signature - Webhook signature
   * @param {Object} payload - Webhook payload
   * @param {string} secret - Webhook secret
   * @returns {boolean} Signature is valid
   */
  verifyWebhookSignature(signature, payload, secret) {
    try {
      if (!signature || !secret) {
        return true; // Skip verification if no signature or secret
      }
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying webhook signature', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handle health check endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async healthCheck(req, res) {
    try {
      logger.info('Health check requested');
      
      // Test both services
      const jotformStatus = await this.jotformService.validateConnection();
      const bitrix24Status = await this.bitrix24Service.validateConnection();
      
      const allHealthy = jotformStatus.success && bitrix24Status.success;
      
      const response = {
        status: allHealthy ? 'healthy' : 'partial',
        timestamp: new Date().toISOString(),
        services: {
          jotform: {
            status: jotformStatus.success ? 'up' : 'down',
            message: jotformStatus.message || jotformStatus.error
          },
          bitrix24: {
            status: bitrix24Status.success ? 'up' : 'down',
            message: bitrix24Status.message || bitrix24Status.error
          }
        }
      };
      
      return res.status(allHealthy ? 200 : 503).json(response);
      
    } catch (error) {
      logger.error('Health check error', { error: error.message });
      
      return res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle test webhook endpoint for development
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async testWebhook(req, res) {
    try {
      logger.info('=== TEST WEBHOOK DEBUG ===', { 
        body: req.body,
        headers: req.headers,
        method: req.method,
        url: req.url
      });
      
      // Create test submission data
      const testData = {
        submissionID: 'test_' + Date.now(),
        answers: {
          '3': { name: 'fullName', answer: 'Test User' },
          '4': { name: 'email', answer: 'test@example.com' },
          '5': { name: 'phone', answer: '+1234567890' }
        },
        created_at: new Date().toISOString()
      };
      
      logger.info('=== TEST DATA CREATED ===', { testData });
      
      // Process test data
      const contactData = this.jotformService.parseSubmissionData(testData);
      
      logger.info('=== TEST CONTACT DATA PARSED ===', { contactData });
      
      const result = await this.processContactInBitrix24(contactData);
      
      logger.info('=== TEST BITRIX24 RESULT ===', { result });
      
      return res.status(200).json({
        success: true,
        message: 'Test webhook processed',
        testData: contactData,
        result
      });
      
    } catch (error) {
      logger.error('Test webhook error', { error: error.message });
      
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Parse Jotform data directly from webhook
   * @param {Object} formData - Form data from rawRequest
   * @param {string} submissionId - Submission ID
   * @returns {Object} Parsed contact data
   */
  parseJotformData(formData, submissionId) {
    try {
      const contactData = {
        fullName: '',
        phone: '',
        email: '',
        submissionId: submissionId,
        submittedAt: formData.submitDate ? new Date(parseInt(formData.submitDate)).toISOString() : new Date().toISOString()
      };

      // Parse name from q3_name
      if (formData.q3_name) {
        const nameObj = formData.q3_name;
        if (typeof nameObj === 'object') {
          const firstName = nameObj.first || '';
          const lastName = nameObj.last || '';
          contactData.fullName = `${firstName} ${lastName}`.trim();
        } else {
          contactData.fullName = nameObj.toString();
        }
      }

      // Parse phone from q4_phoneNumber
      if (formData.q4_phoneNumber) {
        const phoneObj = formData.q4_phoneNumber;
        if (typeof phoneObj === 'object') {
          contactData.phone = phoneObj.full || phoneObj.area + phoneObj.phone || '';
        } else {
          contactData.phone = phoneObj.toString();
        }
      }

      // Parse email from q5_email
      if (formData.q5_email) {
        contactData.email = formData.q5_email.toString();
      }

      logger.info('Parsed Jotform contact data', {
        submissionId,
        contactData,
        originalFormData: {
          q3_name: formData.q3_name,
          q4_phoneNumber: formData.q4_phoneNumber,
          q5_email: formData.q5_email
        }
      });

      return contactData;
    } catch (error) {
      logger.error('Failed to parse Jotform data', {
        submissionId,
        formData,
        error: error.message
      });
      
      return {
        fullName: '',
        phone: '',
        email: '',
        submissionId: submissionId,
        submittedAt: new Date().toISOString()
      };
    }
  }
}

module.exports = WebhookController;
