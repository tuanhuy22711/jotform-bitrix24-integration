const JotformService = require('../services/jotformService');
const Bitrix24Service = require('../services/bitrix24Service');
const logger = require('../utils/logger');
const crypto = require('crypto');

class WebhookController {
  constructor() {
    this.jotformService = new JotformService();
    this.bitrix24Service = new Bitrix24Service();
  }

  /**
   * Handle Jotform webhook submissions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleJotformWebhook(req, res) {
    const startTime = Date.now();
    
    try {
      logger.logWebhook('Jotform', 'submission', req.body, req.headers);
      
      // Validate webhook payload
      const validationResult = this.validateWebhookPayload(req.body);
      if (!validationResult.isValid) {
        logger.error('Invalid webhook payload', { 
          errors: validationResult.errors,
          body: req.body 
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook payload',
          details: validationResult.errors
        });
      }

      // Extract submission data
      const submissionId = req.body.submissionID || req.body.submission_id;
      
      if (!submissionId) {
        logger.error('Missing submission ID in webhook', { body: req.body });
        return res.status(400).json({
          success: false,
          error: 'Missing submission ID'
        });
      }

      logger.info('Processing Jotform webhook', { submissionId });

      // Get full submission data from Jotform API
      const submissionResult = await this.jotformService.getSubmission(submissionId);
      
      if (!submissionResult.success) {
        logger.error('Failed to get submission from Jotform', {
          submissionId,
          error: submissionResult.error
        });
        
        return res.status(500).json({
          success: false,
          error: 'Failed to retrieve submission data'
        });
      }

      // Parse contact data from submission
      const contactData = this.jotformService.parseSubmissionData(submissionResult.data);
      
      if (!contactData.fullName && !contactData.email && !contactData.phone) {
        logger.warn('No valid contact data found in submission', {
          submissionId,
          contactData
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
          contactId: bitrixResult.contactId,
          leadId: bitrixResult.leadId,
          duration
        });
        
        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
          data: {
            submissionId,
            contactId: bitrixResult.contactId,
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
          error: 'Failed to process contact in CRM',
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
      let contactId = null;
      let leadId = null;
      let isNewContact = false;

      // First, search for existing contact
      if (contactData.email || contactData.phone) {
        const searchResult = await this.bitrix24Service.searchContact({
          email: contactData.email,
          phone: contactData.phone
        });

        if (searchResult.success && searchResult.found) {
          // Update existing contact
          const existingContact = searchResult.contacts[0];
          contactId = existingContact.ID;
          
          logger.info('Found existing contact, updating', {
            contactId,
            fullName: contactData.fullName
          });
          
          const updateResult = await this.bitrix24Service.updateContact(contactId, contactData);
          
          if (!updateResult.success) {
            logger.error('Failed to update existing contact', {
              contactId,
              error: updateResult.error
            });
            // Continue to create lead even if update fails
          }
        } else {
          // Create new contact
          isNewContact = true;
          const createResult = await this.bitrix24Service.createContact(contactData);
          
          if (createResult.success) {
            contactId = createResult.contactId;
            logger.info('Created new contact', { contactId });
          } else {
            logger.error('Failed to create contact', {
              error: createResult.error
            });
            // Continue to create lead even if contact creation fails
          }
        }
      }

      // Always create a lead for new submissions
      const leadResult = await this.bitrix24Service.createLead(contactData);
      
      if (leadResult.success) {
        leadId = leadResult.leadId;
        logger.info('Created lead', { leadId, contactId });
      } else {
        logger.error('Failed to create lead', {
          error: leadResult.error
        });
      }

      // Return success if at least one operation succeeded
      if (contactId || leadId) {
        return {
          success: true,
          contactId,
          leadId,
          isNewContact
        };
      } else {
        return {
          success: false,
          error: 'Failed to create both contact and lead'
        };
      }

    } catch (error) {
      logger.error('Error processing contact in Bitrix24', {
        error: error.message,
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
    
    // Check for required fields
    if (!payload.submissionID && !payload.submission_id) {
      errors.push('Missing submission ID');
    }
    
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
      logger.info('Test webhook called', { body: req.body });
      
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
      
      // Process test data
      const contactData = this.jotformService.parseSubmissionData(testData);
      const result = await this.processContactInBitrix24(contactData);
      
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
}

module.exports = WebhookController;
