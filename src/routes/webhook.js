const express = require('express');
const multer = require('multer');
const logger = require('../utils/logger');
const { createLead } = require('../services/bitrix24');

const router = express.Router();
const upload = multer(); // For parsing multipart/form-data

/**
 * Parse Jotform data from webhook
 */
function parseJotformData(formData, submissionId) {
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
      contactData.phone = phoneObj.full || '';
    } else {
      contactData.phone = phoneObj.toString();
    }
  }

  // Parse email from q5_email
  if (formData.q5_email) {
    contactData.email = formData.q5_email.toString();
  }

  return contactData;
}

/**
 * POST /webhook/jotform
 * Handle Jotform webhook submissions
 */
router.post('/jotform', upload.none(), async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Jotform webhook received', {
      submissionID: req.body.submissionID,
      hasRawRequest: !!req.body.rawRequest,
      ip: req.ip
    });

    // Lấy submission ID
    const submissionId = req.body.submissionID;
    if (!submissionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing submission ID'
      });
    }

    // Parse form data từ rawRequest
    let formData = {};
    if (req.body.rawRequest) {
      try {
        formData = JSON.parse(req.body.rawRequest);
      } catch (error) {
        logger.error('Failed to parse rawRequest', { error: error.message });
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON in rawRequest'
        });
      }
    }

    // Parse contact data
    const contactData = parseJotformData(formData, submissionId);
    
    logger.info('Contact data parsed', {
      submissionId,
      fullName: contactData.fullName,
      email: contactData.email,
      phone: contactData.phone
    });

    // Validate có ít nhất một thông tin liên hệ
    if (!contactData.fullName && !contactData.email && !contactData.phone) {
      return res.status(400).json({
        success: false,
        error: 'No valid contact data found'
      });
    }

    // Tạo lead trong Bitrix24
    const result = await createLead(contactData);
    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info('Lead created successfully', {
        submissionId,
        leadId: result.leadId,
        duration
      });

      return res.status(200).json({
        success: true,
        message: 'Lead created successfully in Bitrix24',
        data: {
          submissionId,
          leadId: result.leadId,
          processingTime: duration
        }
      });
    } else {
      logger.error('Failed to create lead', {
        submissionId,
        error: result.error,
        duration
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to create lead in Bitrix24',
        details: result.error
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack,
      duration
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /webhook/test
 * Test endpoint for development
 */
router.post('/test', async (req, res) => {
  try {
    logger.info('Test webhook called');

    // Tạo test data
    const testContactData = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '0123456789',
      submissionId: 'test_' + Date.now(),
      submittedAt: new Date().toISOString()
    };

    // Test tạo lead
    const result = await createLead(testContactData);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Test webhook processed successfully',
        data: {
          testContactData,
          leadId: result.leadId
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Test failed',
        details: result.error
      });
    }

  } catch (error) {
    logger.error('Test webhook error', { error: error.message });
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
