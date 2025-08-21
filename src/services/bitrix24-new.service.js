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
   * Process installation auth data from Bitrix24
   */
  async processInstallation(authData) {
    try {
      logger.info('🎯 Processing installation auth data', {
        hasAccessToken: !!(authData.access_token || authData.AUTH_ID),
        hasRefreshToken: !!(authData.refresh_token || authData.REFRESH_ID),
        domain: authData.domain || authData.DOMAIN,
        scope: authData.scope,
        expiresIn: authData.expires_in,
        method: authData.method,
        authExpires: authData.authExpires || authData.AUTH_EXPIRES,
        placement: authData.placement || authData.PLACEMENT,
        protocol: authData.PROTOCOL,
        lang: authData.LANG,
        appSid: authData.APP_SID
      });

      // Normalize data - prefer Bitrix24 format if available
      const normalizedData = {
        access_token: authData.AUTH_ID || authData.access_token,
        refresh_token: authData.REFRESH_ID || authData.refresh_token,
        expires_in: authData.AUTH_EXPIRES ? parseInt(authData.AUTH_EXPIRES) : authData.expires_in,
        domain: authData.DOMAIN || authData.domain,
        scope: authData.scope,
        method: authData.method || 'oauth2',
        placement: authData.PLACEMENT || authData.placement,
        member_id: authData.member_id,
        status: authData.status,
        client_endpoint: authData.client_endpoint,
        server_endpoint: authData.server_endpoint,
        application_token: authData.application_token
      };

      logger.info('🔄 Normalized auth data', normalizedData);

      // Handle different auth methods
      if (normalizedData.method === 'simplified_auth' || !normalizedData.access_token) {
        return await this.processSimplifiedAuth({
          ...authData,
          domain: normalizedData.domain,
          authExpires: authData.AUTH_EXPIRES || authData.authExpires || '3600'
        });
      }

      // Handle OAuth2 flow
      if (!normalizedData.access_token) {
        throw new Error('Access token is required for OAuth2 flow');
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (normalizedData.expires_in || 3600));

      // Prepare token data for OAuth2
      const tokenData = new TokenData({
        access_token: normalizedData.access_token,
        refresh_token: normalizedData.refresh_token,
        expires_in: normalizedData.expires_in,
        expires_at: expiresAt,
        domain: normalizedData.domain,
        scope: normalizedData.scope,
        client_endpoint: normalizedData.client_endpoint,
        server_endpoint: normalizedData.server_endpoint,
        member_id: normalizedData.member_id,
        status: normalizedData.status,
        application_token: normalizedData.application_token,
        method: 'oauth2',
        created_at: new Date(),
        updated_at: new Date()
      });

      // Save token to database
      await this.databaseService.saveToken(tokenData);

      logger.info('💾 OAuth2 token saved successfully', {
        domain: tokenData.domain,
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id
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
      logger.error('❌ Installation processing failed', {
        error: error.message,
        authData: {
          domain: authData.domain || authData.DOMAIN,
          hasAccessToken: !!(authData.access_token || authData.AUTH_ID),
          method: authData.method
        }
      });
      throw error;
    }
  }

  /**
   * Process simplified auth method
   */
  async processSimplifiedAuth(authData) {
    try {
      logger.info('🔧 Processing simplified auth', {
        domain: authData.domain,
        memberId: authData.member_id,
        authExpires: authData.authExpires,
        fullAuthData: authData
      });

      // For simplified auth, we'll generate an access token using client credentials
      const accessToken = await this.generateAccessTokenForSimplifiedAuth(authData);

      logger.info('🔑 Generated access token for simplified auth', {
        tokenLength: accessToken.length,
        domain: authData.domain
      });

      // Calculate expiration date
      const expiresAt = new Date();
      const expiresIn = parseInt(authData.authExpires || '3600');
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      // Prepare token data for simplified auth
      const tokenData = new TokenData({
        access_token: accessToken,
        expires_in: expiresIn,
        expires_at: expiresAt,
        domain: authData.domain,
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
        expiresAt: tokenData.expires_at,
        memberId: tokenData.member_id,
        method: 'simplified_auth'
      };

    } catch (error) {
      logger.error('❌ Simplified auth processing failed', {
        error: error.message,
        stack: error.stack,
        domain: authData.domain,
        authData: authData
      });
      throw error;
    }
  }

  /**
   * Call Bitrix24 API with simplified auth (using client credentials)
   */
  async callBitrixAPIWithSimplifiedAuth(method, params, token) {
    try {
      logger.info('🔧 Calling Bitrix24 API with simplified auth', {
        method,
        domain: token.domain,
        memberId: token.member_id
      });

      // For simplified auth, we use webhook method with client credentials
      const webhookUrl = `https://${token.domain}/rest/${token.member_id}/${this.clientSecret}/${method}`;

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
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Generate access token for simplified auth using client credentials
   */
  async generateAccessTokenForSimplifiedAuth(authData) {
    try {
      const clientId = this.configService.get('BITRIX24_CLIENT_ID');
      const clientSecret = this.configService.get('BITRIX24_CLIENT_SECRET');
      const domain = authData.domain;

      if (!clientId || !clientSecret || !domain) {
        throw new Error('Missing required configuration for simplified auth');
      }

      // For Bitrix24 simplified auth, we can use client_id + client_secret as access token
      // This is a simplified approach - in production, you might want to call Bitrix24 API to get proper token
      const tokenBase = `${clientId}:${clientSecret}:${domain}:${authData.member_id}`;
      const accessToken = Buffer.from(tokenBase).toString('base64');

      logger.info('🔑 Generated access token for simplified auth', {
        domain,
        memberId: authData.member_id
      });

      return accessToken;

    } catch (error) {
      logger.error('❌ Failed to generate access token for simplified auth', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, state) {
    try {
      logger.info('🔄 Exchanging authorization code for token', {
        hasCode: !!code,
        state
      });

      const tokenUrl = 'https://oauth.bitrix.info/oauth/token/';
      const params = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      };

      const response = await this.httpService.post(tokenUrl, null, {
        params,
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
        scope: tokenData.scope
      });

      // Save token similar to installation
      const authDto = new BitrixAuthDto({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        domain: tokenData.domain,
        client_endpoint: tokenData.client_endpoint,
        server_endpoint: tokenData.server_endpoint,
        member_id: tokenData.member_id,
        status: tokenData.status
      });

      return await this.processInstallation(authDto);

    } catch (error) {
      logger.error('❌ Token exchange failed', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
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
      const isExpired = now > token.expires_at;
      const timeRemaining = isExpired ? 0 : Math.round((token.expires_at.getTime() - now.getTime()) / 1000 / 60);

      return {
        hasToken: true,
        domain: token.domain,
        expiresAt: token.expires_at,
        isExpired,
        timeRemaining: isExpired ? 'Expired' : `${timeRemaining} minutes`,
        scope: token.scope,
        memberId: token.member_id,
        status: token.status
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
      const isExpired = now > token.expires_at;
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

      const tokenUrl = 'https://oauth.bitrix.info/oauth/token/';
      const params = {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: token.refresh_token
      };

      const response = await this.httpService.post(tokenUrl, null, {
        params,
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
   * Generic function to call Bitrix24 API
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

        // For simplified auth, don't check token expiration as it uses client credentials
        if (token.method === 'simplified_auth') {
          return await this.callBitrixAPIWithSimplifiedAuth(method, params, token);
        }

        // Check if token needs refresh (only for OAuth2)
        const now = new Date();
        if (token.access_token && now > token.expires_at) {
          logger.info('🔄 Token expired, refreshing...');
          await this.refreshTokenIfNeeded();
          // Get updated token
          token = await this.databaseService.getCurrentToken();
          if (!token) {
            throw new Error('Failed to refresh token');
          }
        }

        // Prepare API URL
        const baseUrl = token.client_endpoint || `https://${token.domain}/rest/`;
        const apiUrl = `${baseUrl}${method}`;

        // Prepare request data
        const requestData = {
          ...params,
          auth: token.access_token
        };

        // Make API call
        const response = await this.httpService.post(apiUrl, requestData, {
          timeout: this.apiTimeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const result = response.data;

        // Handle API errors
        if (result.error) {
          // Check if it's a token-related error
          if (this.isTokenError(result.error)) {
            logger.warn('🔄 Token error detected, attempting refresh', {
              error: result.error,
              attempt
            });

            if (attempt < this.retryAttempts) {
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
          time: result.time?.duration
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
   * Create a new lead in Bitrix24 CRM
   */
  async createLead(contactData) {
    try {
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

      logger.info('Creating Bitrix24 lead', {
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
