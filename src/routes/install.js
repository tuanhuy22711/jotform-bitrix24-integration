const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const config = require('../config/config');
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
 * POST /install - Handle ONAPPINSTALL event callback
 * This is the recommended method for getting full OAuth2 tokens
 */
router.post('/install', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const body = req.body;
    
    logger.info('🎯 ONAPPINSTALL EVENT RECEIVED', {
      event: body.event,
      hasAuthData: !!(body.auth && body.auth.access_token),
      timestamp: body.ts,
      data: body.data,
      fullBody: JSON.stringify(body, null, 2)
    });

    // Check if this is an ONAPPINSTALL event
    if (body.event === 'ONAPPINSTALL' && body.auth) {
      logger.info('🔄 PROCESSING ONAPPINSTALL EVENT', {
        hasAccessToken: !!body.auth.access_token,
        hasRefreshToken: !!body.auth.refresh_token,
        domain: body.auth.domain,
        scope: body.auth.scope,
        expiresIn: body.auth.expires_in,
        status: body.auth.status
      });

      // Process the ONAPPINSTALL event
      const result = await bitrix24Service.processInstallation(body);

      if (result.hasToken) {
        logger.info('✅ ONAPPINSTALL EVENT PROCESSED SUCCESSFULLY', {
          domain: result.domain,
          memberId: result.memberId,
          method: result.method,
          scope: result.scope
        });

        return res.json({
          success: true,
          message: 'Application installed successfully via ONAPPINSTALL event',
          data: {
            domain: result.domain,
            memberId: result.memberId,
            method: result.method,
            scope: result.scope,
            expiresAt: result.expiresAt
          }
        });
      } else {
        logger.error('❌ FAILED TO PROCESS ONAPPINSTALL EVENT', {
          error: 'No token generated',
          authData: body.auth
        });

        return res.status(400).json({
          success: false,
          error: 'Failed to process ONAPPINSTALL event',
          message: 'No token generated'
        });
      }
    }

    // If not ONAPPINSTALL event, return error
    return res.status(400).json({
      success: false,
      error: 'Invalid event type',
      message: 'Expected ONAPPINSTALL event'
    });

  } catch (error) {
    logger.error('ONAPPINSTALL event processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'ONAPPINSTALL event processing failed',
      message: error.message
    });
  }
});

/**
 * POST / - Bitrix24 app installation handler
 * Handles both traditional installation and installation events (ONAPPINSTALL)
 */
router.post('/', async (req, res) => {
  try {
    // Ensure services are initialized
    const services = await initializeServices();
    bitrix24Service = services.bitrix24Service;

    const { DOMAIN, PROTOCOL, LANG, APP_SID } = req.query;
    const body = req.body;
    console.log(req.body);
    logger.info('🚀 BITRIX24 INSTALLATION REQUEST - FULL DATA', {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      query: req.query,
      body: body,
      rawBody: JSON.stringify(body, null, 2),
      contentType: req.get('content-type'),
      userAgent: req.get('user-agent'),
      hasAuthData: !!(body.auth && body.auth.access_token),
      requestMethod: req.method,
      originalUrl: req.originalUrl
    });

    // Check if this is an installation event (ONAPPINSTALL)
    if (body.event === 'ONAPPINSTALL' && body.auth) {
      logger.info('🎯 PROCESSING ONAPPINSTALL EVENT WITH AUTH DATA', {
        event: body.event,
        timestamp: body.ts,
        eventData: body.data,
        authData: {
          access_token: body.auth.access_token,
          expires_in: body.auth.expires_in,
          scope: body.auth.scope,
          domain: body.auth.domain,
          server_endpoint: body.auth.server_endpoint,
          status: body.auth.status,
          client_endpoint: body.auth.client_endpoint,
          member_id: body.auth.member_id,
          refresh_token: body.auth.refresh_token,
          application_token: body.auth.application_token
        },
        fullAuthObject: body.auth
      });
      
      const result = await bitrix24Service.processInstallation(body.auth);
      
      if (result.hasToken) {
        logger.info('✅ INSTALLATION EVENT PROCESSED SUCCESSFULLY', {
          domain: result.domain,
          memberId: result.memberId,
          status: result.status,
          hasAccessToken: !!result.accessToken,
          hasRefreshToken: !!result.refreshToken,
          clientEndpoint: result.clientEndpoint,
          serverEndpoint: result.serverEndpoint,
          scope: result.scope,
          expiresIn: result.expiresIn
        });

        return res.json({
          success: true,
          message: 'Application installed and authorized successfully',
          data: {
            domain: result.domain,
            memberId: result.memberId,
            status: result.status,
            method: 'installation_event',
            scope: result.scope,
            expiresIn: result.expiresIn
          }
        });
      } else {
        logger.error('❌ FAILED TO PROCESS INSTALLATION EVENT', {
          error: 'No token generated',
          authData: body.auth
        });
        
        return res.status(400).json({
          success: false,
          error: 'Failed to process installation event',
          message: 'No token generated'
        });
      }
    }

    // Check if this is installation with direct auth data (AUTH_ID, REFRESH_ID)
    if (body.AUTH_ID && body.REFRESH_ID && DOMAIN) {
      logger.info('🎯 PROCESSING INSTALLATION WITH DIRECT AUTH DATA', {
        authId: body.AUTH_ID ? `${body.AUTH_ID.substring(0, 20)}...` : null,
        refreshId: body.REFRESH_ID ? `${body.REFRESH_ID.substring(0, 20)}...` : null,
        authExpires: body.AUTH_EXPIRES,
        memberId: body.member_id,
        status: body.status,
        domain: DOMAIN,
        placement: body.PLACEMENT,
        placementOptions: body.PLACEMENT_OPTIONS
      });

      // Process simplified auth data - convert to standard format
      const authData = {
        access_token: body.AUTH_ID,
        refresh_token: body.REFRESH_ID,
        expires_in: body.AUTH_EXPIRES || '3600',
        domain: DOMAIN,
        member_id: body.member_id,
        status: body.status,
        client_endpoint: `https://${DOMAIN}/rest/`,
        server_endpoint: 'https://oauth.bitrix.info/rest/',
        method: 'simplified_auth'
      };

      const result = await bitrix24Service.processInstallation(authData);
      
      if (result.hasToken) {
        logger.info('✅ SIMPLIFIED AUTH PROCESSED SUCCESSFULLY', {
          domain: result.domain,
          memberId: result.memberId,
          status: result.status,
          hasAccessToken: !!result.accessToken,
          hasRefreshToken: !!result.refreshToken,
          clientEndpoint: result.clientEndpoint,
          serverEndpoint: result.serverEndpoint
        });

        return res.json({
          success: true,
          message: 'Application installed and authorized successfully with simplified method',
          data: {
            domain: result.domain,
            memberId: result.memberId,
            status: result.status,
            method: 'simplified_auth',
            placement: body.PLACEMENT,
            authExpires: body.AUTH_EXPIRES
          }
        });
      } else {
        logger.error('❌ FAILED TO PROCESS SIMPLIFIED AUTH', {
          error: 'No token generated',
          authData: authData
        });
        
        return res.status(400).json({
          success: false,
          error: 'Failed to process simplified auth',
          message: 'No token generated'
        });
      }
    }

    // Traditional installation flow
    if (!DOMAIN) {
      return res.status(400).json({
        success: false,
        error: 'Missing DOMAIN parameter'
      });
    }

    logger.info('Processing traditional installation', {
      domain: DOMAIN,
      protocol: PROTOCOL,
      language: LANG,
      appSid: APP_SID
    });

    // In production, you would:
    // 1. Store installation info in database
    // 2. Generate unique app configuration
    // 3. Setup webhooks if needed

    // For now, redirect to authorization
    const authUrl = `/oauth/authorize?domain=${DOMAIN}`;
    
    // Return installation success response
    res.json({
      success: true,
      message: 'App installed successfully',
      data: {
        domain: DOMAIN,
        language: LANG,
        installId: APP_SID,
        nextStep: 'Please authorize the application',
        authorizationUrl: authUrl,
        method: 'traditional_install'
      },
      redirectTo: authUrl
    });

  } catch (error) {
    logger.error('App installation error', {
      error: error.message,
      stack: error.stack,
      query: req.query,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Installation failed',
      message: error.message
    });
  }
});

/**
 * GET / - App installation info page
 */
router.get('/', (req, res) => {
  const { DOMAIN, PROTOCOL, LANG, APP_SID } = req.query;

  if (DOMAIN) {
    // This is an installation request from Bitrix24
    logger.info('Bitrix24 app installation page request', {
      domain: DOMAIN,
      protocol: PROTOCOL,
      language: LANG,
      appSid: APP_SID
    });

    // Return installation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Jotform-Bitrix24 Integration</title>
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
          }
          .header { 
            text-align: center; 
            color: #333; 
            margin-bottom: 30px;
          }
          .step {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            border-radius: 4px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 5px;
          }
          .button:hover { background: #0056b3; }
          .info { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Jotform-Bitrix24 Integration</h1>
            <p>Tích hợp tự động từ Jotform vào Bitrix24 CRM</p>
          </div>
          
          <div class="step">
            <h3>✅ Cài đặt thành công!</h3>
            <p>Ứng dụng đã được cài đặt vào domain: <strong>${DOMAIN}</strong></p>
          </div>

          <div class="step">
            <h3>🔐 Bước tiếp theo: Ủy quyền</h3>
            <p>Chọn một trong hai phương thức ủy quyền:</p>
            
            <div style="margin: 15px 0; padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
              <h4>📋 Phương thức 1: OAuth 2.0 (Khuyến nghị)</h4>
              <p>Phương thức tiêu chuẩn với quyền truy cập đầy đủ vào CRM:</p>
              <a href="/oauth/authorize?domain=${DOMAIN}" class="button">OAuth 2.0 Authorization</a>
            </div>
            
            <div style="margin: 15px 0; padding: 15px; background: #f3e5f5; border-left: 4px solid #9c27b0; border-radius: 4px;">
              <h4>⚡ Phương thức 2: Simplified Auth (Đã cài đặt)</h4>
              <p>Phương thức đã được cài đặt tự động, có thể có giới hạn về quyền truy cập.</p>
              <p style="color: #666; font-size: 14px;">✅ Đã hoàn thành với AUTH_ID token</p>
            </div>
          </div>

          <div class="step">
            <h3>📋 Cách sử dụng:</h3>
            <ol>
              <li>Hoàn thành ủy quyền</li>
              <li>Cấu hình webhook Jotform: <code>POST /webhook/jotform</code></li>
              <li>Submit form trên Jotform</li>
              <li>Lead tự động được tạo trong Bitrix24</li>
            </ol>
          </div>

          <div class="info">
            <p><strong>Domain:</strong> ${DOMAIN}</p>
            <p><strong>Language:</strong> ${LANG}</p>
            <p><strong>App ID:</strong> ${APP_SID}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } else {
    // Regular app info page
    res.json({
      name: 'Jotform-Bitrix24 Integration API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: 'GET /health',
        oauth: 'GET /oauth/authorize',
        webhook: 'POST /webhook/jotform',
        install: 'POST /?DOMAIN=xxx&PROTOCOL=1&LANG=vn&APP_SID=xxx'
      },
      documentation: '/api/info'
    });
  }
});

module.exports = router;
