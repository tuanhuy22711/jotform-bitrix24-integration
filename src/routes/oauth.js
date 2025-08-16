const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const Bitrix24Service = require('../services/bitrix24');

const bitrix24Service = new Bitrix24Service();

/**
 * GET /oauth/authorize - Redirect to Bitrix24 OAuth2 authorization
 */
router.get('/authorize', (req, res) => {
  try {
    const authUrl = bitrix24Service.getAuthorizationUrl();
    
    logger.info('Redirecting to Bitrix24 OAuth2 authorization', {
      authUrl: authUrl.substring(0, 100) + '...'
    });

    // For development, return the URL instead of redirecting
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        message: 'Please visit this URL to authorize the application',
        authorizationUrl: authUrl,
        instructions: 'Copy and paste this URL in your browser to complete authorization'
      });
    }

    // In production, redirect directly
    res.redirect(authUrl);

  } catch (error) {
    logger.error('OAuth authorization error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
});

/**
 * GET /oauth/callback - Handle OAuth2 callback from Bitrix24
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    logger.info('OAuth2 callback received', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error
    });

    if (error) {
      logger.error('OAuth2 authorization denied', {
        error,
        errorDescription: req.query.error_description
      });

      return res.status(400).json({
        success: false,
        error: 'Authorization denied',
        message: req.query.error_description || error
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code',
        message: 'No authorization code received from Bitrix24'
      });
    }

    // Exchange code for tokens
    const tokenResult = await bitrix24Service.handleOAuthCallback(code);

    if (tokenResult.success) {
      logger.info('OAuth2 authorization successful', {
        hasAccessToken: !!tokenResult.accessToken,
        hasRefreshToken: !!tokenResult.refreshToken,
        expiresIn: tokenResult.expiresIn,
        domain: tokenResult.domain
      });

      // For development, show the tokens
      if (process.env.NODE_ENV === 'development') {
        return res.json({
          success: true,
          message: 'Authorization successful! Your application is now connected to Bitrix24.',
          data: {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            expiresIn: tokenResult.expiresIn,
            scope: tokenResult.scope,
            domain: tokenResult.domain
          },
          nextSteps: [
            'Save these tokens securely',
            'Set BITRIX24_ACCESS_TOKEN environment variable',
            'Set BITRIX24_REFRESH_TOKEN environment variable',
            'Test the webhook endpoint'
          ]
        });
      }

      // In production, show success page
      res.send(`
        <html>
          <head><title>Authorization Successful</title></head>
          <body>
            <h1>✅ Authorization Successful!</h1>
            <p>Your Jotform-Bitrix24 integration is now connected.</p>
            <p>You can close this window and return to your application.</p>
          </body>
        </html>
      `);

    } else {
      logger.error('OAuth2 token exchange failed', {
        error: tokenResult.error,
        details: tokenResult.details
      });

      return res.status(500).json({
        success: false,
        error: 'Token exchange failed',
        message: tokenResult.error,
        details: tokenResult.details
      });
    }

  } catch (error) {
    logger.error('OAuth2 callback error', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: 'OAuth callback processing failed',
      message: error.message
    });
  }
});

/**
 * GET /oauth/status - Check OAuth2 authorization status
 */
router.get('/status', async (req, res) => {
  try {
    const accessToken = bitrix24Service.getAccessToken();
    
    if (!accessToken) {
      return res.json({
        success: false,
        authorized: false,
        message: 'Not authorized. Please complete OAuth2 authorization.',
        authorizationUrl: '/oauth/authorize'
      });
    }

    // Test connection with current token
    const connectionTest = await bitrix24Service.testConnection();

    return res.json({
      success: true,
      authorized: connectionTest.success,
      message: connectionTest.success ? 
        'Authorized and connected to Bitrix24' : 
        'Authorization token may be expired',
      connectionTest,
      accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : null
    });

  } catch (error) {
    logger.error('OAuth status check error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to check authorization status',
      message: error.message
    });
  }
});

/**
 * POST /oauth/token - Manually set access token (for development)
 */
router.post('/token', (req, res) => {
  try {
    const { accessToken, refreshToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing access token',
        message: 'accessToken is required'
      });
    }

    bitrix24Service.setTokens(accessToken, refreshToken);

    logger.info('Access token set manually', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });

    res.json({
      success: true,
      message: 'Access token set successfully',
      hasRefreshToken: !!refreshToken
    });

  } catch (error) {
    logger.error('Manual token setting error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to set access token',
      message: error.message
    });
  }
});

module.exports = router;
