const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { ServiceContainer } = require('../services/service-container');

let container;
let bitrix24Service;

// Initialize services asynchronously
async function initializeServices() {
  if (!container) {
    container = ServiceContainer.getInstance();
    await container.initializeServices();
    bitrix24Service = await container.getBitrix24Service();
  }
  return { container, bitrix24Service };
}

/**
 * GET /api/contacts - Get contact list
 */
router.get('/contacts', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

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
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

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
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const contactId = req.params.id;
    const updateData = req.body;

    logger.info('API: Updating contact', {
      contactId,
      updateData,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.updateContact(contactId, updateData);

    if (result.success) {
      res.json({
        success: true,
        data: result.contact,
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
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const contactId = req.params.id;

    logger.info('API: Deleting contact', {
      contactId,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.deleteContact(contactId);

    if (result.success) {
      res.json({
        success: true,
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
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

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
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'Missing method parameter'
      });
    }

    logger.info('API: Generic Bitrix24 call', {
      method,
      hasParams: !!params,
      userAgent: req.get('User-Agent')
    });

    const result = await bitrix24Service.callBitrixAPI(method, params || {});

    if (result.success) {
      res.json({
        success: true,
        data: result.result,
        total: result.total,
        time: result.time,
        next: result.next
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.error_description
      });
    }

  } catch (error) {
    logger.error('API: Generic Bitrix24 call error', {
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
 * GET /api/test-token - Test current token
 */
router.get('/test-token', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Testing current token');

    const result = await bitrix24Service.getTokenStatus();

    if (result.hasToken) {
      res.json({
        success: true,
        data: result,
        message: 'Token is valid'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'No valid token',
        details: result
      });
    }

  } catch (error) {
    logger.error('API: Test token error', {
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
 * POST /api/token/clear - Clear current token and recommend OAuth 2.0
 */
router.post('/token/clear', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Clearing current token');

    const databaseService = await services.container.getDatabaseService();
    await databaseService.clearAllTokens();

    res.json({
      success: true,
      message: 'Current token cleared successfully',
      recommendation: {
        title: 'Upgrade to OAuth 2.0 for Full CRM Access',
        description: 'The current simplified auth token has limited permissions. For full CRM access, please use OAuth 2.0.',
        steps: [
          'Visit the OAuth 2.0 authorization URL',
          'Complete the authorization flow',
          'Get full access to CRM methods'
        ],
        authorizationUrl: '/oauth/authorize',
        benefits: [
          'Full access to CRM methods (leads, contacts, deals)',
          'Proper token expiration and refresh',
          'Standard OAuth 2.0 security'
        ]
      }
    });

  } catch (error) {
    logger.error('API: Clear token error', {
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
 * POST /api/test-onappinstall - Test ONAPPINSTALL event simulation
 */
router.post('/test-onappinstall', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Testing ONAPPINSTALL event simulation');

    // Simulate ONAPPINSTALL event data
    const mockONAPPINSTALLData = {
      event: 'ONAPPINSTALL',
      data: {
        VERSION: '1',
        LANGUAGE_ID: 'en'
      },
      ts: Math.floor(Date.now() / 1000),
      auth: {
        access_token: 'test_access_token_' + Date.now(),
        expires_in: '3600',
        scope: 'crm,entity,im',
        domain: bitrix24Service.domain || 'b24-7woulk.bitrix24.vn',
        server_endpoint: 'https://oauth.bitrix.info/rest/',
        status: 'F',
        client_endpoint: `https://${bitrix24Service.domain || 'b24-7woulk.bitrix24.vn'}/rest/`,
        member_id: 'test_member_id_' + Date.now(),
        refresh_token: 'test_refresh_token_' + Date.now(),
        application_token: 'test_app_token_' + Date.now()
      }
    };

    // Process the mock ONAPPINSTALL event
    const result = await bitrix24Service.processInstallation(mockONAPPINSTALLData);

    if (result.hasToken) {
      res.json({
        success: true,
        message: 'ONAPPINSTALL event simulation successful',
        data: {
          domain: result.domain,
          memberId: result.memberId,
          method: result.method,
          scope: result.scope,
          expiresAt: result.expiresAt,
          mockData: mockONAPPINSTALLData
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to process ONAPPINSTALL simulation',
        message: 'No token generated'
      });
    }

  } catch (error) {
    logger.error('API: ONAPPINSTALL test error', {
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
 * GET /api/simplified-auth-test - Test simplified auth and show available methods (optimized)
 */
router.get('/simplified-auth-test', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Testing simplified auth capabilities (optimized)');

    const tokenStatus = await bitrix24Service.getTokenStatus();
    
    // If no token, return early
    if (!tokenStatus.hasToken) {
      return res.json({
        success: true,
        message: 'No token available',
        data: {
          tokenStatus,
          availableMethods: {
            working: [],
            failed: [],
            total: 0,
            workingCount: 0
          },
          capabilities: {
            hasCrmAccess: false,
            hasUserAccess: false,
            hasAppAccess: false,
            hasPlacementAccess: false
          },
          recommendations: [
            'No token available. Please complete installation first.',
            'Use ONAPPINSTALL event for full CRM access',
            'Or use simplified method for basic access'
          ]
        }
      });
    }

    // Only test methods if we have a token
    const availableMethods = await bitrix24Service.testAvailableMethods();

    // Filter available methods
    const workingMethods = Object.keys(availableMethods).filter(method => availableMethods[method].success);
    const failedMethods = Object.keys(availableMethods).filter(method => !availableMethods[method].success);

    res.json({
      success: true,
      message: 'Simplified auth test completed (optimized)',
      data: {
        tokenStatus,
        availableMethods: {
          working: workingMethods,
          failed: failedMethods,
          total: Object.keys(availableMethods).length,
          workingCount: workingMethods.length
        },
        capabilities: {
          hasCrmAccess: workingMethods.some(method => method.startsWith('crm.')),
          hasUserAccess: workingMethods.includes('user.current'),
          hasAppAccess: workingMethods.some(method => method.startsWith('app.')),
          hasPlacementAccess: workingMethods.some(method => method.startsWith('placement.'))
        },
        recommendations: workingMethods.length === 0 ? [
          'No methods available with current token',
          'Consider upgrading to OAuth 2.0 for full access'
        ] : [
          `Current token provides ${workingMethods.length} available methods`,
          workingMethods.some(method => method.startsWith('crm.')) ? 
            '✅ CRM access available' : '⚠️ Limited CRM access',
          'For full CRM access, consider OAuth 2.0'
        ]
      }
    });

  } catch (error) {
    logger.error('API: Simplified auth test error', {
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
 * POST /api/upgrade-to-oauth2 - Clear simplified auth and upgrade to OAuth 2.0
 */
router.post('/upgrade-to-oauth2', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Upgrading from simplified auth to OAuth 2.0');

    const databaseService = await services.container.getDatabaseService();
    await databaseService.clearAllTokens();

    // Generate OAuth 2.0 authorization URL
    const authUrl = bitrix24Service.getAuthorizationUrl();

    res.json({
      success: true,
      message: 'Successfully cleared simplified auth token',
      data: {
        action: 'upgraded_to_oauth2',
        authorizationUrl: authUrl,
        instructions: [
          '1. Click the authorizationUrl above or copy it to your browser',
          '2. Complete the OAuth 2.0 authorization flow',
          '3. You will be redirected back with an authorization code',
          '4. The system will automatically exchange the code for OAuth 2.0 tokens',
          '5. Test the webhook to verify full CRM access'
        ],
        benefits: [
          '✅ Full access to CRM methods (leads, contacts, deals)',
          '✅ Proper token expiration and refresh',
          '✅ Standard OAuth 2.0 security',
          '✅ No more "Method not found" errors'
        ]
      }
    });

  } catch (error) {
    logger.error('API: Upgrade to OAuth 2.0 error', {
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
 * DELETE /api/token - Clear current token and recommend OAuth 2.0
 */
router.delete('/token', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Clearing current token');

    const databaseService = await services.container.getDatabaseService();
    await databaseService.clearAllTokens();

    res.json({
      success: true,
      message: 'Current token cleared successfully',
      recommendation: {
        title: 'Upgrade to OAuth 2.0 for Full CRM Access',
        description: 'The current simplified auth token has limited permissions. For full CRM access, please use OAuth 2.0.',
        steps: [
          'Visit the OAuth 2.0 authorization URL',
          'Complete the authorization flow',
          'Get full access to CRM methods'
        ],
        authorizationUrl: '/oauth/authorize',
        benefits: [
          'Full access to CRM methods (leads, contacts, deals)',
          'Proper token expiration and refresh',
          'Standard OAuth 2.0 security'
        ]
      }
    });

  } catch (error) {
    logger.error('API: Clear token error', {
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
 * GET /api/test-methods - Test available Bitrix24 API methods
 */
router.get('/test-methods', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Testing available Bitrix24 methods');

    const result = await bitrix24Service.testAvailableMethods();

    res.json({
      success: true,
      data: result,
      message: 'Available methods test completed'
    });

  } catch (error) {
    logger.error('API: Test methods error', {
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
 * GET /api/status - Get API status
 */
router.get('/status', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('API: Getting status');

    const tokenStatus = await bitrix24Service.getTokenStatus();
    const configStatus = {
      hasClientId: !!bitrix24Service.clientId,
      hasClientSecret: !!bitrix24Service.clientSecret,
      hasDomain: !!bitrix24Service.domain,
      hasRedirectUri: !!bitrix24Service.redirectUri
    };

    res.json({
      success: true,
      data: {
        api: 'running',
        timestamp: new Date().toISOString(),
        token: tokenStatus,
        config: configStatus,
        recommendations: tokenStatus.recommendation ? [tokenStatus.recommendation] : []
      }
    });

  } catch (error) {
    logger.error('API: Status error', {
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
