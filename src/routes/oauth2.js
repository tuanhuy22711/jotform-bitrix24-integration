const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { ServiceContainer } = require('../services/service-container');

const container = ServiceContainer.getInstance();
const bitrix24Service = container.getBitrix24Service();

/**
 * GET /oauth2/start - Start Complete OAuth 2.0 Authorization Protocol
 * User provides their Bitrix24 domain and gets redirected to authorization
 */
router.get('/start', (req, res) => {
  try {
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
router.post('/domain', (req, res) => {
  try {
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
      error: 'Failed to process domain',
      message: error.message
    });
  }
});

/**
 * GET /oauth2/callback - Handle OAuth2 callback from user's Bitrix24
 * This is where user gets redirected after authorization
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, domain, member_id, scope, server_domain, error } = req.query;

    logger.info('🔄 COMPLETE OAUTH2 CALLBACK RECEIVED', {
      timestamp: new Date().toISOString(),
      query: req.query,
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
        domain,
        fullQuery: req.query
      });

      return res.status(400).json({
        success: false,
        error: 'Authorization denied',
        message: req.query.error_description || error,
        domain: domain
      });
    }

    if (!code) {
      logger.error('❌ MISSING AUTHORIZATION CODE', {
        query: req.query,
        domain
      });
      
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
        message: 'No authorization code received from Bitrix24',
        domain: domain
      });
    }

    // Exchange code for tokens using oauth.bitrix.info
    logger.info('🔄 STARTING TOKEN EXCHANGE WITH OAUTH.BITRIX.INFO', {
      code: code.substring(0, 20) + '...',
      domain,
      state,
      memberId: member_id
    });

    const tokenResult = await bitrix24Service.handleOAuthCallback(code, domain);

    logger.info('🎯 COMPLETE OAUTH2 TOKEN EXCHANGE RESULT', {
      success: tokenResult.success,
      hasAccessToken: !!tokenResult.accessToken,
      hasRefreshToken: !!tokenResult.refreshToken,
      expiresIn: tokenResult.expiresIn,
      domain: tokenResult.domain,
      memberId: tokenResult.memberId,
      status: tokenResult.status,
      scope: tokenResult.scope,
      clientEndpoint: tokenResult.clientEndpoint,
      serverEndpoint: tokenResult.serverEndpoint
    });

    if (tokenResult.success) {
      logger.info('✅ COMPLETE OAUTH2 FLOW SUCCESSFUL', {
        domain: tokenResult.domain,
        memberId: tokenResult.memberId,
        status: tokenResult.status,
        hasTokens: !!(tokenResult.accessToken && tokenResult.refreshToken)
      });

      // Success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authorization Successful</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            .success {
              color: #28a745;
              font-size: 48px;
              margin-bottom: 20px;
            }
            .info {
              margin: 15px 0;
              padding: 10px;
              background: #f8f9fa;
              border-radius: 4px;
            }
            .token-info {
              font-family: monospace;
              font-size: 12px;
              color: #666;
              margin-top: 20px;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Authorization Successful!</h1>
            <p>Your Jotform-Bitrix24 integration is now connected and ready to use.</p>
            
            <div class="info">
              <strong>Domain:</strong> ${tokenResult.domain}
            </div>
            <div class="info">
              <strong>Status:</strong> ${tokenResult.status}
            </div>
            <div class="info">
              <strong>Scope:</strong> ${tokenResult.scope}
            </div>
            
            <p>You can now:</p>
            <ul style="text-align: left;">
              <li>Configure Jotform webhooks to: <code>/webhook/jotform</code></li>
              <li>Test API connection: <code>/api/test-token</code></li>
              <li>Check status: <code>/api/status</code></li>
            </ul>

            ${process.env.NODE_ENV === 'development' ? `
            <div class="token-info">
              <strong>Debug Info (Development Only):</strong><br>
              Access Token: ${tokenResult.accessToken?.substring(0, 30)}...<br>
              Expires In: ${tokenResult.expiresIn} seconds<br>
              Client Endpoint: ${tokenResult.clientEndpoint}
            </div>
            ` : ''}
          </div>
        </body>
        </html>
      `);

    } else {
      logger.error('❌ COMPLETE OAUTH2 TOKEN EXCHANGE FAILED', {
        error: tokenResult.error,
        details: tokenResult.details,
        domain
      });

      res.status(400).json({
        success: false,
        error: 'Token exchange failed',
        message: tokenResult.error,
        details: tokenResult.details,
        domain: domain
      });
    }

  } catch (error) {
    logger.error('🚨 COMPLETE OAUTH2 CALLBACK ERROR', {
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
    const connectionTest = await bitrix24Service.testConnection();
    const hasAccessToken = !!bitrix24Service.getAccessToken();
    
    // Load token info from storage
    const tokenStore = require('../utils/tokenStore');
    const savedTokens = tokenStore.loadTokens();

    res.json({
      success: true,
      data: {
        protocol: 'complete_oauth2',
        connected: connectionTest.success,
        hasAccessToken: hasAccessToken,
        connectionMessage: connectionTest.message,
        user: connectionTest.user,
        tokenInfo: savedTokens ? {
          domain: savedTokens.domain,
          expiresAt: savedTokens.expiresAt,
          status: savedTokens.status,
          hasRefreshToken: !!savedTokens.refreshToken,
          scope: savedTokens.scope
        } : null,
        timestamp: new Date().toISOString()
      },
      message: 'Complete OAuth2 status retrieved successfully'
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
