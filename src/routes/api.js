const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const Bitrix24Service = require('../services/bitrix24');

const bitrix24Service = new Bitrix24Service();

/**
 * GET /api/contacts - Get contact list
 */
router.get('/contacts', async (req, res) => {
  try {
    const options = {
      select: req.query.select ? req.query.select.split(',') : undefined,
      filter: req.query.filter ? JSON.parse(req.query.filter) : {},
      order: req.query.order ? JSON.parse(req.query.order) : undefined,
      start: req.query.start ? parseInt(req.query.start) : 0
    };

    logger.info('API: Getting contact list', {
      options: options,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.getContactList(options);

    if (result.success) {
      res.json({
        success: true,
        data: result.contacts,
        total: result.total,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('API: Contact list error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/:id - Get contact by ID
 */
router.get('/contacts/:id', async (req, res) => {
  try {
    const contactId = req.params.id;

    logger.info('API: Getting contact by ID', {
      contactId,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.getContact(contactId);

    if (result.success) {
      res.json({
        success: true,
        data: result.contact,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('API: Get contact error', {
      contactId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * PUT /api/contacts/:id - Update contact
 */
router.put('/contacts/:id', async (req, res) => {
  try {
    const contactId = req.params.id;
    const contactData = req.body;

    logger.info('API: Updating contact', {
      contactId,
      updateFields: Object.keys(contactData),
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.updateContact(contactId, contactData);

    if (result.success) {
      res.json({
        success: true,
        data: { contactId: result.contactId },
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('API: Update contact error', {
      contactId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/contacts/:id - Delete contact
 */
router.delete('/contacts/:id', async (req, res) => {
  try {
    const contactId = req.params.id;

    logger.info('API: Deleting contact', {
      contactId,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.deleteContact(contactId);

    if (result.success) {
      res.json({
        success: true,
        data: { contactId: result.contactId },
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('API: Delete contact error', {
      contactId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/products - Get product list
 */
router.get('/products', async (req, res) => {
  try {
    const options = {
      select: req.query.select ? req.query.select.split(',') : undefined,
      filter: req.query.filter ? JSON.parse(req.query.filter) : {},
      order: req.query.order ? JSON.parse(req.query.order) : undefined,
      start: req.query.start ? parseInt(req.query.start) : 0
    };

    logger.info('API: Getting product list', {
      options: options,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.getProductList(options);

    if (result.success) {
      res.json({
        success: true,
        data: result.products,
        total: result.total,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('API: Product list error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/bitrix24 - Generic Bitrix24 API call
 */
router.post('/bitrix24', async (req, res) => {
  try {
    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: method'
      });
    }

    logger.info('API: Generic Bitrix24 API call', {
      method,
      paramCount: params ? Object.keys(params).length : 0,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.makeApiCall(method, params || {});

    if (result.success) {
      res.json({
        success: true,
        data: result.result,
        total: result.total,
        time: result.time,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    logger.error('API: Generic API call error', {
      method: req.body.method,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/test-token - Test current token by calling user.current
 */
router.get('/test-token', async (req, res) => {
  try {
    logger.info('🧪 TESTING CURRENT TOKEN', {
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    const result = await bitrix24Service.makeApiCall('user.current');

    if (result.success) {
      logger.info('✅ TOKEN TEST SUCCESSFUL', {
        userId: result.result?.ID,
        userName: result.result?.NAME,
        userEmail: result.result?.EMAIL,
        isAdmin: result.result?.IS_ADMIN,
        active: result.result?.ACTIVE,
        fullUserData: result.result
      });

      res.json({
        success: true,
        data: {
          user: result.result,
          tokenStatus: 'valid',
          testMethod: 'user.current'
        },
        message: 'Token is valid and working'
      });
    } else {
      logger.error('❌ TOKEN TEST FAILED', {
        error: result.error,
        details: result.details
      });

      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        tokenStatus: 'invalid'
      });
    }

  } catch (error) {
    logger.error('🚨 TOKEN TEST ERROR', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/status - Get API status and connection info
 */
router.get('/status', async (req, res) => {
  try {
    logger.info('API: Checking status', {
      userAgent: req.get('User-Agent')
    });

    const connectionTest = await bitrix24Service.testConnection();
    const hasAccessToken = !!bitrix24Service.getAccessToken();
    
    // Load token info from storage
    const tokenStore = require('../utils/tokenStore');
    const savedTokens = tokenStore.loadTokens();

    res.json({
      success: true,
      data: {
        connected: connectionTest.success,
        hasAccessToken: hasAccessToken,
        connectionMessage: connectionTest.message,
        user: connectionTest.user,
        tokenInfo: savedTokens ? {
          domain: savedTokens.domain,
          expiresAt: savedTokens.expiresAt,
          status: savedTokens.status,
          hasRefreshToken: !!savedTokens.refreshToken
        } : null,
        timestamp: new Date().toISOString()
      },
      message: 'API status retrieved successfully'
    });

  } catch (error) {
    logger.error('API: Status check error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
