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
 * GET /oauth2/start - Start Complete OAuth 2.0 Authorization Protocol
 * User provides their Bitrix24 domain and gets redirected to authorization
 */
router.get('/start', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Missing domain parameter',
        message: 'Please provide your Bitrix24 domain (e.g., yourcompany.bitrix24.com)'
      });
    }

    logger.info('🚀 STARTING COMPLETE OAUTH2 FLOW', {
      userDomain: domain,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const authUrl = bitrix24Service.getAuthorizationUrl(domain);
    
    logger.info('🔗 GENERATED AUTHORIZATION URL', {
      domain: domain,
      authUrl: authUrl.substring(0, 100) + '...'
    });

    // For development, return the URL instead of redirecting
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        message: 'Please visit this URL to authorize the application',
        data: {
          authorizationUrl: authUrl,
          domain: domain,
          instructions: 'Copy and paste this URL in your browser to complete authorization',
          protocol: 'complete_oauth2'
        }
      });
    }

    // In production, redirect directly
    res.redirect(authUrl);

  } catch (error) {
    logger.error('❌ OAUTH2 START ERROR', {
      error: error.message,
      stack: error.stack,
      domain: req.query.domain
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start OAuth2 flow',
      message: error.message
    });
  }
});

/**
 * POST /oauth2/domain - Submit domain for OAuth2 authorization
 * Alternative to GET method for domain submission
 */
router.post('/domain', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Missing domain parameter',
        message: 'Please provide your Bitrix24 domain'
      });
    }

    logger.info('📝 DOMAIN SUBMITTED FOR OAUTH2', {
      userDomain: domain,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const authUrl = bitrix24Service.getAuthorizationUrl(domain);
    
    res.json({
      success: true,
      message: 'Authorization URL generated successfully',
      data: {
        authorizationUrl: authUrl,
        domain: domain,
        nextStep: 'Redirect user to authorization URL',
        protocol: 'complete_oauth2'
      }
    });

  } catch (error) {
    logger.error('❌ DOMAIN SUBMISSION ERROR', {
      error: error.message,
      stack: error.stack,
      domain: req.body.domain
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
});

/**
 * GET /oauth2/callback - Handle OAuth2 callback from Bitrix24
 */
router.get('/callback', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const { code, state, domain, member_id, scope, server_domain, error } = req.query;

    logger.info('🔄 OAUTH2 CALLBACK RECEIVED - FULL DATA', {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      query: req.query,
      fullQuery: JSON.stringify(req.query, null, 2),
      hasCode: !!code,
      hasState: !!state,
      domain,
      memberId: member_id,
      scope,
      serverDomain: server_domain,
      hasError: !!error,
      userAgent: req.get('user-agent'),
      referer: req.get('referer')
    });

    if (error) {
      logger.error('❌ OAUTH2 AUTHORIZATION DENIED', {
        error,
        errorDescription: req.query.error_description,
        fullQuery: req.query
      });

      return res.status(400).json({
        success: false,
        error: 'Authorization denied',
        message: req.query.error_description || error
      });
    }

    if (!code) {
      logger.error('❌ MISSING AUTHORIZATION CODE', {
        query: req.query
      });
      
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
        message: 'No authorization code received from Bitrix24'
      });
    }

    // Exchange code for tokens
    logger.info('🔄 STARTING TOKEN EXCHANGE', {
      code: code.substring(0, 20) + '...',
      domain,
      state
    });

    const result = await bitrix24Service.exchangeCodeForToken(code, state);

    if (result.success) {
      logger.info('✅ TOKEN EXCHANGE SUCCESSFUL', {
        domain: result.domain,
        memberId: result.memberId,
        method: result.method
      });

      return res.json({
        success: true,
        message: 'OAuth2 authorization completed successfully',
        data: {
          domain: result.domain,
          memberId: result.memberId,
          method: result.method,
          protocol: 'complete_oauth2'
        }
      });
    } else {
      logger.error('❌ TOKEN EXCHANGE FAILED', {
        error: result.error,
        details: result.details
      });

      return res.status(400).json({
        success: false,
        error: 'Token exchange failed',
        message: result.error
      });
    }

  } catch (error) {
    logger.error('❌ OAUTH2 CALLBACK ERROR', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: 'OAuth2 callback processing failed',
      message: error.message
    });
  }
});

/**
 * GET /oauth2/status - Get OAuth2 status
 */
router.get('/status', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    logger.info('📊 GETTING OAUTH2 STATUS');

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
        oauth2: 'available',
        timestamp: new Date().toISOString(),
        token: tokenStatus,
        config: configStatus,
        protocol: 'complete_oauth2'
      }
    });

  } catch (error) {
    logger.error('❌ OAUTH2 STATUS ERROR', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get OAuth2 status',
      message: error.message
    });
  }
});

module.exports = router;
