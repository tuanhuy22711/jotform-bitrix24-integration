const logger = require('../utils/logger');
const ConfigService = require('./config.service');
const HttpService = require('./http.service');
const DatabaseService = require('./database.service');
const { BitrixAuthDto, TokenData, ApiResponse } = require('../dto/bitrix-auth.dto');

/**
 * Bitrix24 Service with dependency injection pattern
 */
class Bitrix24NewService {
  constructor(configService, httpService, databaseService) {
    this.configService = configService;
    this.httpService = httpService;
    this.databaseService = databaseService;
    
    const bitrixConfig = this.configService.getBitrix24Config();
    
    this.clientId = bitrixConfig.clientId;
    this.clientSecret = bitrixConfig.clientSecret;
    this.domain = bitrixConfig.domain;
    this.redirectUri = bitrixConfig.redirectUri;
    this.apiTimeout = bitrixConfig.apiTimeout;
    this.retryAttempts = bitrixConfig.retryAttempts;
    this.retryDelay = bitrixConfig.retryDelay;

    logger.info('🔧 Bitrix24NewService initialized', {
      clientId: this.clientId ? '***' : 'NOT_SET',
      domain: this.domain,
      redirectUri: this.redirectUri
    });
  }

  /**
   * Process installation auth data from Bitrix24 (Simplified Method)
   */
  async processInstallation(authData) {
    try {
      logger.info('🎯 Processing installation auth data (Simplified Method)', {
        hasAccessToken: !!(authData.access_token || authData.AUTH_ID),
        hasRefreshToken: !!(authData.refresh_token || authData.REFRESH_ID),
        domain: authData.domain || authData.DOMAIN,
        scope: authData.scope,
        expiresIn: authData.expires_in || authData.AUTH_EXPIRES,
        method: authData.method,
        event: authData.event,
        memberId: authData.member_id,
        status: authData.status,
        appSid: authData.APP_SID
      });

      // Handle ONAPPINSTALL event (recommended method)
      if (authData.event === 'ONAPPINSTALL' && authData.auth) {
        logger.info('🔄 Processing ONAPPINSTALL event with auth data');
        return await this.processONAPPINSTALLEvent(authData.auth);
      }

      // Handle direct installation POST data (simplified method)
      if (authData.AUTH_ID && authData.DOMAIN) {
        logger.info('🔄 Processing direct installation POST data');
        return await this.processDirectInstallationData(authData);
      }

      // Handle OAuth2 flow (if access_token is provided)
      if (authData.access_token && !authData.AUTH_ID) {
        logger.info('🔄 Processing OAuth2 flow');
        return await this.processOAuth2Flow(authData);
      }

      throw new Error('Invalid installation data format');

    } catch (error) {
      logger.error('❌ Installation processing failed', {
        error: error.message,
        authData: {
          domain: authData.domain || authData.DOMAIN,
          hasAccessToken: !!(authData.access_token || authData.AUTH_ID),
          event: authData.event,
          method: authData.method
        }
      });
      throw error;
    }
  }

  /**
   * Process ONAPPINSTALL event (recommended method)
   */
  async processONAPPINSTALLEvent(authData) {
    try {
      logger.info('🎯 Processing ONAPPINSTALL event auth data', {
        hasAccessToken: !!authData.access_token,
        hasRefreshToken: !!authData.refresh_token,
        domain: authData.domain,
        scope: authData.scope,
        expiresIn: authData.expires_in,
        status: authData.status
      });

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (authData.expires_in || 3600));

      // Create token data for OAuth2 (from ONAPPINSTALL)
      const tokenData = new TokenData({
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        expires_in: authData.expires_in,
        expires_at: expiresAt,
        domain: authData.domain,
        scope: authData.scope,
        client_endpoint: authData.client_endpoint,
        server_endpoint: authData.server_endpoint,
        member_id: authData.member_id,
        status: authData.status,
        application_token: authData.application_token,
        method: 'oauth2',
        created_at: new Date(),
        updated_at: new Date()
      });

      // Save token to database
      await this.databaseService.saveToken(tokenData);

      logger.info('💾 ONAPPINSTALL token saved successfully', {
        domain: tokenData.domain,
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id,
        scope: tokenData.scope
      });

      return {
        domain: tokenData.domain,
        hasToken: true,
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id,
        scope: tokenData.scope,
        method: 'oauth2'
      };

    } catch (error) {
      logger.error('❌ ONAPPINSTALL processing failed', {
        error: error.message,
        authData: authData
      });
      throw error;
    }
  }

  /**
   * Process direct installation POST data (simplified method)
   */
  async processDirectInstallationData(authData) {
    try {
      logger.info('🎯 Processing direct installation POST data', {
        domain: authData.DOMAIN,
        authId: authData.AUTH_ID ? `${authData.AUTH_ID.substring(0, 20)}...` : null,
        refreshId: authData.REFRESH_ID ? `${authData.REFRESH_ID.substring(0, 20)}...` : null,
        authExpires: authData.AUTH_EXPIRES,
        memberId: authData.member_id,
        status: authData.status
      });

      // For simplified auth, we'll use the actual AUTH_ID as access token
      const accessToken = authData.AUTH_ID;

      logger.info('🔑 Using AUTH_ID for simplified auth', {
        tokenLength: accessToken.length,
        domain: authData.DOMAIN
      });

      // For simplified auth, AUTH_ID tokens don't expire, so we don't set expiration
      const tokenData = new TokenData({
        access_token: accessToken,
        refresh_token: authData.REFRESH_ID,
        expires_in: null, // No expiration for AUTH_ID tokens
        expires_at: null, // No expiration for AUTH_ID tokens
        domain: authData.DOMAIN,
        member_id: authData.member_id,
        status: authData.status,
        method: 'simplified_auth',
        created_at: new Date(),
        updated_at: new Date()
      });

      logger.info('💾 Saving simplified auth token to database', {
        tokenData: {
          ...tokenData,
          access_token: '***MASKED***'  // Don't log full token
        }
      });

      // Save token to database
      await this.databaseService.saveToken(tokenData);

      logger.info('💾 Simplified auth token saved successfully', {
        domain: tokenData.domain,
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id
      });

      return {
        domain: tokenData.domain,
        hasToken: true,
        memberId: tokenData.member_id,
        method: 'simplified_auth'
      };

    } catch (error) {
      logger.error('❌ Direct installation processing failed', {
        error: error.message,
        authData: authData
      });
      throw error;
    }
  }

  /**
   * Process OAuth2 flow
   */
  async processOAuth2Flow(authData) {
    try {
      logger.info('🎯 Processing OAuth2 flow', {
        hasAccessToken: !!authData.access_token,
        hasRefreshToken: !!authData.refresh_token,
        domain: authData.domain,
        scope: authData.scope
      });

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (authData.expires_in || 3600));

      // Create token data for OAuth2
      const tokenData = new TokenData({
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        expires_in: authData.expires_in,
        expires_at: expiresAt,
        domain: authData.domain,
        scope: authData.scope,
        client_endpoint: authData.client_endpoint,
        server_endpoint: authData.server_endpoint,
        member_id: authData.member_id,
        status: authData.status,
        application_token: authData.application_token,
        method: 'oauth2',
        created_at: new Date(),
        updated_at: new Date()
      });

      // Save token to database
      await this.databaseService.saveToken(tokenData);

      logger.info('💾 OAuth2 token saved successfully', {
        domain: tokenData.domain,
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id,
        scope: tokenData.scope
      });

      return {
        domain: tokenData.domain,
        hasToken: true,
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id,
        scope: tokenData.scope,
        method: 'oauth2'
      };

    } catch (error) {
      logger.error('❌ OAuth2 flow processing failed', {
        error: error.message,
        authData: authData
      });
      throw error;
    }
  }

  /**
   * Call Bitrix24 API with simplified auth (using webhook method)
   */
  async callBitrixAPIWithSimplifiedAuth(method, params, token) {
    try {
      logger.info('🔧 Calling Bitrix24 API with simplified auth', {
        method,
        domain: token.domain,
        memberId: token.member_id
      });

      // For simplified auth, we use webhook method with the AUTH_ID
      // Format: https://domain.bitrix24.vn/rest/AUTH_ID/method
      const webhookUrl = `https://${token.domain}/rest/${token.access_token}/${method}`;

      logger.info('🔗 Using webhook URL', {
        webhookUrl: webhookUrl.replace(token.access_token, '***MASKED***'),
        method,
        hasParams: Object.keys(params).length > 0
      });

      // Make API call using webhook URL
      const response = await this.httpService.post(webhookUrl, params, {
        timeout: this.apiTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;

      logger.info('✅ Simplified auth API call successful', {
        method,
        hasResult: !!result.result,
        total: result.total
      });

      return new ApiResponse({
        success: true,
        result: result.result,
        total: result.total,
        time: result.time || null,
        next: result.next || null
      });

    } catch (error) {
      logger.error('❌ Simplified auth API call failed', {
        method,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Check if it's a permission error
      if (error.response?.data?.error === 'ERROR_METHOD_NOT_FOUND') {
        throw new Error(`Method '${method}' not available with simplified auth. This method requires OAuth 2.0 with CRM scope.`);
      }

      throw error;
    }
  }

  /**
   * Generate access token for simplified auth using client credentials
   */
  async generateAccessTokenForSimplifiedAuth(authData) {
    try {
      // For simplified auth, we use the actual AUTH_ID provided by Bitrix24
      // This is the real access token for the webhook method
      const accessToken = authData.access_token || authData.AUTH_ID;
      
      if (!accessToken) {
        throw new Error('Access token (AUTH_ID) is required for simplified auth');
      }

      logger.info('🔑 Using provided AUTH_ID for simplified auth', {
        domain: authData.domain,
        memberId: authData.member_id,
        tokenLength: accessToken.length
      });

      return accessToken;

    } catch (error) {
      logger.error('❌ Failed to get access token for simplified auth', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate OAuth 2.0 authorization URL (improved based on Bitrix24 docs)
   */
  getAuthorizationUrl(domain = null, state = null) {
    const targetDomain = domain || this.domain;
    if (!targetDomain) {
      throw new Error('Domain is required for authorization URL');
    }

    const stateParam = state || `state_${Date.now()}`;
    
    // Proper OAuth 2.0 URL format according to Bitrix24 docs
    const authUrl = `https://${targetDomain}/oauth/authorize/` +
      `?client_id=${this.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&state=${encodeURIComponent(stateParam)}` +
      `&scope=crm`;

    logger.info('🔗 Generated OAuth 2.0 authorization URL', {
      domain: targetDomain,
      clientId: this.clientId ? '***' : 'NOT_SET',
      redirectUri: this.redirectUri,
      scope: 'crm'
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens (improved OAuth 2.0 flow)
   */
  async exchangeCodeForToken(code, state) {
    try {
      logger.info('🔄 Exchanging authorization code for tokens', {
        hasCode: !!code,
        state
      });

      // Use the domain-specific token endpoint as per the article
      const tokenUrl = `https://${this.domain}/oauth/token/`;
      
      // Prepare form data as per OAuth 2.0 spec (exactly like the article)
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      });

      const response = await this.httpService.post(tokenUrl, params.toString(), {
        timeout: this.apiTimeout,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;

      if (tokenData.error) {
        throw new Error(`OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      logger.info('✅ Token exchange successful', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        domain: tokenData.domain
      });

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

      // Create proper token data for OAuth 2.0
      const fullTokenData = new TokenData({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        expires_at: expiresAt,
        domain: tokenData.domain || this.domain,
        scope: tokenData.scope,
        client_endpoint: tokenData.client_endpoint || `https://${tokenData.domain || this.domain}/rest/`,
        server_endpoint: tokenData.server_endpoint || 'https://oauth.bitrix.info/rest/',
        member_id: tokenData.member_id,
        status: tokenData.status,
        method: 'oauth2',
        created_at: new Date(),
        updated_at: new Date()
      });

      // Save token to database
      await this.databaseService.saveToken(fullTokenData);

      logger.info('💾 OAuth 2.0 tokens saved successfully', {
        domain: fullTokenData.domain,
        expiresAt: fullTokenData.expires_at,
        memberId: fullTokenData.member_id,
        scope: fullTokenData.scope
      });

      return {
        success: true,
        domain: fullTokenData.domain,
        hasToken: true,
        expiresAt: fullTokenData.expires_at,
        memberId: fullTokenData.member_id,
        scope: fullTokenData.scope,
        method: 'oauth2',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      };

    } catch (error) {
      logger.error('❌ Token exchange failed', {
        error: error.message,
        response: error.response?.data
      });
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Handle OAuth callback (legacy method for compatibility)
   */
  async handleOAuthCallback(code, domain) {
    try {
      logger.info('🔄 Handling OAuth callback', {
        hasCode: !!code,
        domain
      });

      // Use the existing exchangeCodeForToken method
      return await this.exchangeCodeForToken(code, domain);

    } catch (error) {
      logger.error('❌ OAuth callback handling failed', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current token status
   */
  async getTokenStatus() {
    try {
      const token = await this.databaseService.getCurrentToken();

      if (!token) {
        return {
          hasToken: false,
          message: 'No token available. Please complete OAuth authorization.'
        };
      }

      const now = new Date();
      const isExpired = token.expires_at ? now > token.expires_at : false;
      const timeRemaining = token.expires_at && !isExpired ? 
        Math.round((token.expires_at.getTime() - now.getTime()) / 1000 / 60) : null;

      return {
        hasToken: true,
        domain: token.domain,
        expiresAt: token.expires_at,
        isExpired,
        timeRemaining: isExpired ? 'Expired' : (timeRemaining ? `${timeRemaining} minutes` : 'No expiration'),
        scope: token.scope,
        memberId: token.member_id,
        status: token.status,
        method: token.method
      };

    } catch (error) {
      logger.error('❌ Failed to get token status', error);
      throw error;
    }
  }

  /**
   * Refresh access token if needed or forced
   */
  async refreshTokenIfNeeded(force = false) {
    try {
      const token = await this.databaseService.getCurrentToken();

      if (!token) {
        throw new Error('No token available for refresh');
      }

      const now = new Date();
      const isExpired = token.expires_at ? now > token.expires_at : false;
      const needsRefresh = force || isExpired;

      if (!needsRefresh) {
        logger.info('🔋 Token is still valid, no refresh needed');
        return { refreshed: false, message: 'Token is still valid' };
      }

      logger.info('🔄 Refreshing access token', {
        isExpired,
        force,
        expiresAt: token.expires_at
      });

      // Use domain-specific token endpoint as per the article
      const tokenUrl = `https://${token.domain}/oauth/token/`;
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: token.refresh_token
      });

      const response = await this.httpService.post(tokenUrl, params.toString(), {
        timeout: this.apiTimeout,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const newTokenData = response.data;

      if (newTokenData.error) {
        throw new Error(`Token refresh error: ${newTokenData.error_description || newTokenData.error}`);
      }

      // Update token in database
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);

      const updatedToken = {
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || token.refresh_token,
        expires_in: newTokenData.expires_in,
        expires_at: expiresAt,
        updated_at: new Date()
      };

      await this.databaseService.updateToken(token.id, updatedToken);

      logger.info('✅ Token refreshed successfully', {
        expiresAt,
        expiresIn: newTokenData.expires_in
      });

      return {
        refreshed: true,
        expiresAt,
        expiresIn: newTokenData.expires_in
      };

    } catch (error) {
      logger.error('❌ Token refresh failed', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Generic function to call Bitrix24 API (improved for OAuth 2.0)
   */
  async callBitrixAPI(method, params = {}) {
    let attempt = 1;
    while (attempt <= this.retryAttempts) {
      try {
        logger.info(`🔄 Calling Bitrix24 API (attempt ${attempt})`, {
          method,
          hasParams: Object.keys(params).length > 0
        });

        // Get current token
        let token = await this.databaseService.getCurrentToken();
        if (!token) {
          throw new Error('No access token available. Please complete OAuth authorization.');
        }

        // For simplified auth, use webhook method
        if (token.method === 'simplified_auth') {
          return await this.callBitrixAPIWithSimplifiedAuth(method, params, token);
        }

        // For OAuth 2.0, check token expiration and refresh if needed
        if (token.method === 'oauth2' && token.expires_at) {
          const now = new Date();
          if (now > token.expires_at) {
            logger.info('🔄 OAuth 2.0 token expired, refreshing...');
            await this.refreshTokenIfNeeded();
            // Get updated token
            token = await this.databaseService.getCurrentToken();
            if (!token) {
              throw new Error('Failed to refresh token');
            }
          }
        }

        // Prepare API URL - use proper REST endpoint for OAuth 2.0
        let apiUrl;
        if (token.method === 'oauth2') {
          // Use standard REST API endpoint with Bearer token (exactly like the article)
          const baseUrl = `https://${token.domain}/rest/`;
          apiUrl = `${baseUrl}${method}`;
        } else {
          // Fallback for other methods
          const baseUrl = token.client_endpoint || `https://${token.domain}/rest/`;
          apiUrl = `${baseUrl}${method}`;
        }

        // Prepare request headers and data (exactly like the article)
        let requestOptions;
        if (token.method === 'oauth2') {
          // OAuth 2.0: Use Bearer token in Authorization header (exactly like the article)
          requestOptions = {
            timeout: this.apiTimeout,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token.access_token}`
            }
          };
        } else {
          // Simplified auth: Include auth in request body
          params.auth = token.access_token;
          requestOptions = {
            timeout: this.apiTimeout,
            headers: {
              'Content-Type': 'application/json'
            }
          };
        }

        // Make API call
        const response = await this.httpService.post(apiUrl, params, requestOptions);
        const result = response.data;

        // Handle API errors
        if (result.error) {
          // Check if it's a token-related error
          if (this.isTokenError(result.error)) {
            logger.warn('🔄 Token error detected, attempting refresh', {
              error: result.error,
              attempt
            });

            if (attempt < this.retryAttempts && token.method === 'oauth2') {
              await this.refreshTokenIfNeeded(true);
              // Get updated token and retry immediately
              token = await this.databaseService.getCurrentToken();
              attempt++;
              continue; // Retry the API call with new token
            }
          }

          throw new Error(`Bitrix24 API error: ${result.error_description || result.error}`);
        }

        logger.info('✅ Bitrix24 API call successful', {
          method,
          hasResult: !!result.result,
          total: result.total,
          time: result.time?.duration,
          authMethod: token.method
        });

        return new ApiResponse({
          success: true,
          result: result.result,
          total: result.total,
          time: result.time
        });

      } catch (error) {
        logger.error(`❌ Bitrix24 API call failed (attempt ${attempt})`, {
          method,
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });

        // If it's the last attempt or not a retryable error, throw
        if (attempt === this.retryAttempts || !this.isRetryableError(error)) {
          throw new Error(`Bitrix24 API call failed: ${error.message}`);
        }

        // Wait before retry
        await this.sleep(this.retryDelay * attempt);
        attempt++;
      }
    }
  }

  /**
   * Check if error is token-related
   */
  isTokenError(error) {
    const tokenErrors = [
      'expired_token',
      'invalid_token', 
      'WRONG_AUTH_TYPE',
      'unauthorized'
    ];
    return tokenErrors.some(tokenError => 
      error.toLowerCase().includes(tokenError.toLowerCase())
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error.response) return true; // Network errors are retryable
    
    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors and rate limiting
  }

  /**
   * Sleep utility for retry delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection to Bitrix24
   */
  async testConnection() {
    try {
      const token = await this.databaseService.getCurrentToken();
      
      if (!token) {
        return {
          success: false,
          error: 'No token available',
          message: 'Please complete OAuth authorization first'
        };
      }

      // Test connection by calling a simple API method
      const result = await this.callBitrixAPI('user.current');
      
      if (result.success) {
        return {
          success: true,
          message: 'Connection successful',
          user: result.result
        };
      } else {
        return {
          success: false,
          error: 'API call failed',
          message: result.error
        };
      }

    } catch (error) {
      logger.error('❌ Connection test failed', {
        error: error.message
      });

      return {
        success: false,
        error: 'Connection test failed',
        message: error.message
      };
    }
  }

  /**
   * Validate connection to Bitrix24
   */
  async validateConnection() {
    try {
      const token = await this.databaseService.getCurrentToken();
      
      if (!token) {
        return {
          success: false,
          error: 'No token available',
          message: 'Please complete OAuth authorization first'
        };
      }

      // Test connection by calling a simple API method
      const result = await this.callBitrixAPI('user.current');
      
      if (result.success) {
        return {
          success: true,
          message: 'Connection successful',
          user: result.result
        };
      } else {
        return {
          success: false,
          error: 'API call failed',
          message: result.error
        };
      }

    } catch (error) {
      logger.error('❌ Connection validation failed', {
        error: error.message
      });

      return {
        success: false,
        error: 'Connection validation failed',
        message: error.message
      };
    }
  }

  /**
   * Get contact list from Bitrix24
   */
  async getContactList(options = {}) {
    try {
      const params = {
        select: options.select || ['ID', 'NAME', 'LAST_NAME', 'EMAIL', 'PHONE'],
        start: options.start || 0
      };

      if (options.filter) {
        params.filter = options.filter;
      }

      if (options.order) {
        params.order = options.order;
      }

      const result = await this.callBitrixAPI('crm.contact.list', params);

      if (result.success) {
        return {
          success: true,
          contacts: result.result,
          total: result.total,
          message: 'Contacts retrieved successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error('❌ Failed to get contact list', {
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to get contact list',
        details: error.message
      };
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId) {
    try {
      const result = await this.callBitrixAPI('crm.contact.get', { id: contactId });

      if (result.success) {
        return {
          success: true,
          contact: result.result,
          message: 'Contact retrieved successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error('❌ Failed to get contact', {
        contactId,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to get contact',
        details: error.message
      };
    }
  }

  /**
   * Update contact
   */
  async updateContact(contactId, updateData) {
    try {
      const params = {
        id: contactId,
        fields: updateData
      };

      const result = await this.callBitrixAPI('crm.contact.update', params);

      if (result.success) {
        return {
          success: true,
          contact: { id: contactId, ...updateData },
          message: 'Contact updated successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error('❌ Failed to update contact', {
        contactId,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to update contact',
        details: error.message
      };
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId) {
    try {
      const result = await this.callBitrixAPI('crm.contact.delete', { id: contactId });

      if (result.success) {
        return {
          success: true,
          message: 'Contact deleted successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error('❌ Failed to delete contact', {
        contactId,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to delete contact',
        details: error.message
      };
    }
  }

  /**
   * Get product list from Bitrix24
   */
  async getProductList(options = {}) {
    try {
      const params = {
        select: options.select || ['ID', 'NAME', 'PRICE', 'CURRENCY_ID'],
        start: options.start || 0
      };

      if (options.filter) {
        params.filter = options.filter;
      }

      if (options.order) {
        params.order = options.order;
      }

      const result = await this.callBitrixAPI('crm.product.list', params);

      if (result.success) {
        return {
          success: true,
          products: result.result,
          total: result.total,
          message: 'Products retrieved successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error('❌ Failed to get product list', {
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to get product list',
        details: error.message
      };
    }
  }

  /**
   * Make API call (legacy method for compatibility)
   */
  async makeApiCall(method, params = {}) {
    try {
      logger.info('🔧 Making API call (legacy method)', {
        method,
        hasParams: Object.keys(params).length > 0
      });

      // Use the existing callBitrixAPI method
      return await this.callBitrixAPI(method, params);

    } catch (error) {
      logger.error('❌ API call failed (legacy method)', {
        method,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load tokens (legacy method for compatibility)
   */
  async loadTokens() {
    try {
      const token = await this.databaseService.getCurrentToken();
      
      if (!token) {
        return null;
      }

      return {
        domain: token.domain,
        expiresAt: token.expires_at,
        status: token.status,
        refreshToken: token.refresh_token,
        scope: token.scope
      };

    } catch (error) {
      logger.error('❌ Failed to load tokens', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Save tokens (legacy method for compatibility)
   */
  async saveTokens(tokenData) {
    try {
      logger.info('💾 Saving tokens (legacy method)', {
        domain: tokenData.domain,
        hasAccessToken: !!tokenData.access_token
      });

      // Use the existing processInstallation method
      return await this.processInstallation(tokenData);

    } catch (error) {
      logger.error('❌ Failed to save tokens (legacy method)', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test available API methods (optimized)
   */
  async testAvailableMethods() {
    try {
      logger.info('🔍 Testing available API methods (optimized)');
      
      // Test only essential methods that are most likely to work
      const testMethods = [
        'user.current',
        'crm.lead.add',
        'crm.contact.add',
        'app.info',
        'scope'
      ];

      const results = {};
      
      for (const method of testMethods) {
        try {
          const result = await this.callBitrixAPI(method);
          results[method] = {
            success: true,
            hasResult: !!result.result
          };
        } catch (error) {
          results[method] = {
            success: false,
            error: error.message
          };
        }
      }

      logger.info('📊 Available methods test results (optimized)', {
        total: testMethods.length,
        successful: Object.keys(results).filter(method => results[method].success).length,
        methods: testMethods
      });
      
      return results;

    } catch (error) {
      logger.error('❌ Failed to test available methods', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new lead in Bitrix24 CRM (optimized)
   */
  async createLead(contactData) {
    try {
      // Get current token to check method
      const token = await this.databaseService.getCurrentToken();
      
      if (!token) {
        return {
          success: false,
          error: 'No token available',
          message: 'Please complete authorization first'
        };
      }

      // If we have OAuth2 token, we can directly create lead without testing
      if (token.method === 'oauth2') {
        logger.info('🔑 Using OAuth2 token for lead creation', {
          submissionId: contactData.submissionId,
          domain: token.domain
        });

        const leadData = {
          fields: {
            TITLE: `Jotform Lead: ${contactData.fullName || 'Unknown'}`,
            NAME: this.extractFirstName(contactData.fullName),
            LAST_NAME: this.extractLastName(contactData.fullName),
            SOURCE_ID: 'WEBFORM',
            STATUS_ID: 'NEW',
            SOURCE_DESCRIPTION: `Jotform Submission ID: ${contactData.submissionId}`,
            COMMENTS: `Lead created from Jotform submission\nSubmission ID: ${contactData.submissionId}\nSubmitted at: ${contactData.submittedAt}`,
            ASSIGNED_BY_ID: 1,
            OPENED: 'Y'
          }
        };

        // Add email if available
        if (contactData.email) {
          leadData.fields.EMAIL = [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }];
        }

        // Add phone if available
        if (contactData.phone) {
          leadData.fields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
        }

        logger.info('Creating Bitrix24 lead with OAuth2', {
          submissionId: contactData.submissionId,
          leadTitle: leadData.fields.TITLE,
          hasName: !!contactData.fullName,
          hasEmail: !!contactData.email,
          hasPhone: !!contactData.phone
        });

        const result = await this.callBitrixAPI('crm.lead.add', leadData);

        if (result.success) {
          logger.info('Lead created successfully in Bitrix24', {
            leadId: result.result,
            submissionId: contactData.submissionId
          });

          return {
            success: true,
            leadId: result.result,
            message: 'Lead created successfully'
          };
        } else {
          return {
            success: false,
            error: result.error,
            details: result.error_description
          };
        }
      }

      // For simplified auth, test available methods first
      logger.info('🔍 Testing available methods for simplified auth');
      const availableMethods = await this.testAvailableMethods();
      
      // Check if crm.lead.add is available
      if (!availableMethods['crm.lead.add']?.success) {
        logger.warn('⚠️ crm.lead.add method not available with simplified auth', {
          availableMethods: Object.keys(availableMethods).filter(method => availableMethods[method].success)
        });
        
        // Try alternative methods that might work with simplified auth
        const alternativeMethods = [
          'crm.contact.add',
          'crm.deal.add',
          'crm.company.add'
        ];

        for (const altMethod of alternativeMethods) {
          if (availableMethods[altMethod]?.success) {
            logger.info(`🔄 Trying alternative method: ${altMethod}`);
            return await this.createContactAlternative(contactData, altMethod);
          }
        }
        
        // If no CRM methods available, return detailed error
        return {
          success: false,
          error: 'No CRM methods available with simplified auth',
          details: 'Simplified auth (AUTH_ID) has limited permissions. Available methods: ' + 
                   Object.keys(availableMethods).filter(method => availableMethods[method].success).join(', '),
          recommendation: {
            title: 'Upgrade to OAuth 2.0 for Full CRM Access',
            description: 'Simplified auth only provides basic access. For full CRM functionality, use OAuth 2.0.',
            authorizationUrl: '/oauth/authorize',
            benefits: [
              'Full access to CRM methods (leads, contacts, deals)',
              'Proper token expiration and refresh',
              'Standard OAuth 2.0 security'
            ]
          }
        };
      }

      // Simplified auth with crm.lead.add available
      const leadData = {
        fields: {
          TITLE: `Jotform Lead: ${contactData.fullName || 'Unknown'}`,
          NAME: this.extractFirstName(contactData.fullName),
          LAST_NAME: this.extractLastName(contactData.fullName),
          SOURCE_ID: 'WEBFORM',
          STATUS_ID: 'NEW',
          SOURCE_DESCRIPTION: `Jotform Submission ID: ${contactData.submissionId}`,
          COMMENTS: `Lead created from Jotform submission\nSubmission ID: ${contactData.submissionId}\nSubmitted at: ${contactData.submittedAt}`,
          ASSIGNED_BY_ID: 1,
          OPENED: 'Y'
        }
      };

      // Add email if available
      if (contactData.email) {
        leadData.fields.EMAIL = [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }];
      }

      // Add phone if available
      if (contactData.phone) {
        leadData.fields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
      }

      logger.info('Creating Bitrix24 lead with simplified auth', {
        submissionId: contactData.submissionId,
        leadTitle: leadData.fields.TITLE,
        hasName: !!contactData.fullName,
        hasEmail: !!contactData.email,
        hasPhone: !!contactData.phone
      });

      const result = await this.callBitrixAPI('crm.lead.add', leadData);

      if (result.success) {
        logger.info('Lead created successfully in Bitrix24', {
          leadId: result.result,
          submissionId: contactData.submissionId
        });

        return {
          success: true,
          leadId: result.result,
          message: 'Lead created successfully'
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error('Error creating Bitrix24 lead', {
        error: error.message,
        submissionId: contactData.submissionId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create contact using alternative method (for simplified auth)
   */
  async createContactAlternative(contactData, method) {
    try {
      const contactFields = {
        fields: {
          NAME: this.extractFirstName(contactData.fullName),
          LAST_NAME: this.extractLastName(contactData.fullName),
          COMMENTS: `Contact created from Jotform submission\nSubmission ID: ${contactData.submissionId}\nSubmitted at: ${contactData.submittedAt}`,
          ASSIGNED_BY_ID: 1,
          OPENED: 'Y'
        }
      };

      // Add email if available
      if (contactData.email) {
        contactFields.fields.EMAIL = [{ VALUE: contactData.email, VALUE_TYPE: 'WORK' }];
      }

      // Add phone if available
      if (contactData.phone) {
        contactFields.fields.PHONE = [{ VALUE: contactData.phone, VALUE_TYPE: 'WORK' }];
      }

      logger.info(`Creating Bitrix24 ${method} with simplified auth`, {
        submissionId: contactData.submissionId,
        method,
        hasName: !!contactData.fullName,
        hasEmail: !!contactData.email,
        hasPhone: !!contactData.phone
      });

      const result = await this.callBitrixAPI(method, contactFields);

      if (result.success) {
        logger.info(`${method} created successfully in Bitrix24`, {
          id: result.result,
          submissionId: contactData.submissionId
        });

        return {
          success: true,
          id: result.result,
          method: method,
          message: `${method} created successfully`
        };
      } else {
        return {
          success: false,
          error: result.error,
          details: result.error_description
        };
      }

    } catch (error) {
      logger.error(`Error creating Bitrix24 ${method}`, {
        error: error.message,
        submissionId: contactData.submissionId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current access token
   */
  async getAccessToken() {
    try {
      const token = await this.databaseService.getCurrentToken();
      
      if (!token) {
        return null;
      }

      // Check if token is expired (only for OAuth2 tokens)
      if (token.method === 'oauth2' && token.expires_at) {
        const now = new Date();
        if (now > token.expires_at) {
          logger.warn('⏰ Access token is expired, attempting refresh');
          await this.refreshTokenIfNeeded();
          // Get updated token
          const updatedToken = await this.databaseService.getCurrentToken();
          return updatedToken ? updatedToken.access_token : null;
        }
      }

      return token.access_token;

    } catch (error) {
      logger.error('❌ Failed to get access token', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Set tokens manually (legacy method for compatibility)
   */
  setTokens(accessToken, refreshToken) {
    // This is a legacy method - for new implementation, use processInstallation
    logger.warn('⚠️ setTokens is a legacy method. Consider using processInstallation instead');
    
    // For compatibility, we'll store this as a simplified token
    const tokenData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      method: 'manual',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Save to database
    this.databaseService.saveToken(new TokenData(tokenData));
  }

  /**
   * Extract first name from full name
   */
  extractFirstName(fullName) {
    if (!fullName) return '';
    return fullName.split(' ')[0] || '';
  }

  /**
   * Extract last name from full name
   */
  extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }
}

module.exports = Bitrix24NewService;
