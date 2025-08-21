const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const tokenStore = require('../utils/tokenStore');

class Bitrix24OAuth {
  constructor() {
    this.clientId = config.bitrix24.clientId;
    this.clientSecret = config.bitrix24.clientSecret;
    this.domain = config.bitrix24.domain;
    this.redirectUri = config.bitrix24.redirectUri;
    this.accessToken = config.bitrix24.accessToken;
    this.refreshToken = config.bitrix24.refreshToken;
    this.clientEndpoint = null; // Will be set after authorization
    this.serverEndpoint = null; // Will be set after authorization
  }

  /**
   * Get OAuth2 authorization URL for Complete OAuth 2.0 Protocol
   * @param {string} domain - User's Bitrix24 domain (e.g., "portal.bitrix24.com")
   * @param {string} state - Optional state parameter
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(domain = null, state = null) {
    const targetDomain = domain || this.domain;
    const stateParam = state || this.generateState();
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      state: stateParam
    });

    // Use the user's specific domain for authorization (Complete OAuth 2.0 Protocol)
    const authUrl = `https://${targetDomain}/oauth/authorize/?${params.toString()}`;
    
    logger.info('Generated Complete OAuth2 authorization URL', {
      url: authUrl,
      clientId: this.clientId,
      domain: targetDomain,
      state: stateParam,
      protocol: 'complete_oauth2'
    });

    return authUrl;
  }

  /**
   * Get user's Bitrix24 domain and redirect to authorization
   * This is the first step of Complete OAuth 2.0 Protocol
   * @param {string} userDomain - User provided domain
   * @param {string} state - Optional state parameter
   * @returns {string} Authorization URL for user's domain
   */
  getUserAuthorizationUrl(userDomain, state = null) {
    // Clean up domain (remove protocol, trailing slash, etc.)
    const cleanDomain = this.cleanDomain(userDomain);
    
    logger.info('🎯 STARTING COMPLETE OAUTH2 FLOW', {
      userProvidedDomain: userDomain,
      cleanedDomain: cleanDomain,
      clientId: this.clientId
    });

    return this.getAuthorizationUrl(cleanDomain, state);
  }

  /**
   * Clean and validate domain
   * @param {string} domain - Domain to clean
   * @returns {string} Cleaned domain
   */
  cleanDomain(domain) {
    if (!domain) return this.domain;
    
    // Remove protocol
    let cleaned = domain.replace(/^https?:\/\//, '');
    
    // Remove trailing slash
    cleaned = cleaned.replace(/\/$/, '');
    
    // Remove paths
    cleaned = cleaned.split('/')[0];
    
    return cleaned;
  }

  /**
   * Process installation event data (ONAPPINSTALL)
   * This is the simplified method for obtaining OAuth 2.0 tokens
   * @param {Object} authData - Auth data from installation event
   * @returns {Object} Processed auth data
   */
  processInstallationAuth(authData) {
    try {
      logger.info('Processing installation auth data', {
        hasAccessToken: !!authData.access_token,
        hasRefreshToken: !!authData.refresh_token,
        domain: authData.domain,
        status: authData.status,
        expiresIn: authData.expires_in
      });

      // Store tokens and endpoints
      this.accessToken = authData.access_token;
      this.refreshToken = authData.refresh_token;
      this.clientEndpoint = authData.client_endpoint;
      this.serverEndpoint = authData.server_endpoint;
      this.domain = authData.domain;

      return {
        success: true,
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
        expiresIn: authData.expires_in,
        scope: authData.scope,
        clientEndpoint: authData.client_endpoint,
        serverEndpoint: authData.server_endpoint,
        domain: authData.domain,
        memberId: authData.member_id,
        status: authData.status,
        applicationToken: authData.application_token
      };

    } catch (error) {
      logger.error('Failed to process installation auth data', {
        error: error.message,
        authData: authData
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @param {string} domain - Bitrix24 domain (optional, from callback)
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code, domain = null) {
    try {
      // Use oauth.bitrix.info as per documentation
      const tokenUrl = 'https://oauth.bitrix.info/oauth/token/';
      
      const params = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code
      };

      logger.info('Exchanging authorization code for token', {
        tokenUrl,
        clientId: this.clientId,
        hasCode: !!code,
        domain: domain || this.domain
      });

      const response = await axios.post(tokenUrl, null, {
        params: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: config.bitrix24.timeout
      });

      const tokenData = response.data;
      
      if (tokenData.error) {
        throw new Error(`OAuth error: ${tokenData.error_description || tokenData.error}`);
      }
      
      logger.info('Token exchange successful', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        clientEndpoint: tokenData.client_endpoint,
        status: tokenData.status
      });

      // Store tokens and endpoints
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      this.clientEndpoint = tokenData.client_endpoint;
      this.serverEndpoint = tokenData.server_endpoint;

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        clientEndpoint: tokenData.client_endpoint,
        serverEndpoint: tokenData.server_endpoint,
        domain: tokenData.domain || domain,
        memberId: tokenData.member_id,
        status: tokenData.status
      };

    } catch (error) {
      logger.error('Token exchange failed', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} Token refresh response
   */
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use oauth.bitrix.info as per documentation
      const tokenUrl = 'https://oauth.bitrix.info/oauth/token/';
      
      const params = {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      };

      logger.info('Refreshing access token', {
        tokenUrl,
        clientId: this.clientId,
        hasRefreshToken: !!this.refreshToken
      });

      const response = await axios.post(tokenUrl, null, {
        params: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: config.bitrix24.timeout
      });

      const tokenData = response.data;
      
      if (tokenData.error) {
        throw new Error(`OAuth refresh error: ${tokenData.error_description || tokenData.error}`);
      }
      
      logger.info('Token refresh successful', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      });

      // Update stored tokens
      this.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        this.refreshToken = tokenData.refresh_token;
      }

      // Persist refreshed tokens
      tokenStore.saveTokens({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        domain: this.domain,
        memberId: null,
        status: null,
        clientEndpoint: this.clientEndpoint,
        serverEndpoint: this.serverEndpoint,
        applicationToken: null
      });

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      };

    } catch (error) {
      logger.error('Token refresh failed', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Make authenticated API call to Bitrix24
   * @param {string} method - API method (e.g., 'crm.lead.add')
   * @param {Object} params - API parameters
   * @returns {Promise<Object>} API response
   */
  async makeApiCall(method, params = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available. Please authorize first.');
      }

      // Use client_endpoint if available, otherwise construct URL
      const baseUrl = this.clientEndpoint || `https://${this.domain}/rest/`;
      const apiUrl = `${baseUrl}${method}`;
      
      // Bitrix24 expects the token in the query string (auth=) or as form params.
      // Passing it in JSON body can be ignored by Bitrix, leading to invalid_token.
      const requestData = { ...params };

      logger.info('Making Bitrix24 API call', {
        method,
        url: apiUrl,
        hasAccessToken: !!this.accessToken,
        paramsCount: Object.keys(params).length
      });

      const response = await axios.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: config.bitrix24.timeout,
        // Ensure token is passed via query string
        params: { auth: this.accessToken }
      });

      const result = response.data;

      if (result.error) {
        // Check if token is expired
        if (result.error === 'expired_token' || result.error === 'invalid_token' || result.error === 'WRONG_AUTH_TYPE') {
          logger.warn('Access token expired, attempting refresh');
          
          const refreshResult = await this.refreshAccessToken();
          if (refreshResult.success) {
            // Retry the API call with new token
            return this.makeApiCall(method, params);
          } else {
            throw new Error('Failed to refresh access token');
          }
        }

        throw new Error(`Bitrix24 API error: ${result.error_description || result.error}`);
      }

      logger.info('Bitrix24 API call successful', {
        method,
        hasResult: !!result.result,
        total: result.total,
        time: result.time
      });

      return {
        success: true,
        result: result.result,
        total: result.total,
        time: result.time
      };

    } catch (error) {
      const status = error.response?.status;
      const apiError = error.response?.data?.error;
      const needsRefresh = status === 401 || apiError === 'expired_token' || apiError === 'invalid_token' || apiError === 'WRONG_AUTH_TYPE';

      if (needsRefresh) {
        logger.warn('Access token invalid/expired, attempting refresh', {
          method,
          status,
          apiError
        });

        const refreshResult = await this.refreshAccessToken();
        if (refreshResult.success) {
          // Retry once with new token
          try {
            const baseUrl = this.clientEndpoint || `https://${this.domain}/rest/`;
            const apiUrl = `${baseUrl}${method}`;
            const response = await axios.post(apiUrl, params, {
              headers: { 'Content-Type': 'application/json' },
              timeout: config.bitrix24.timeout,
              params: { auth: this.accessToken }
            });

            const result = response.data;
            if (result.error) {
              throw new Error(`Bitrix24 API error after refresh: ${result.error_description || result.error}`);
            }

            logger.info('Bitrix24 API call successful after token refresh', {
              method,
              hasResult: !!result.result
            });

            return {
              success: true,
              result: result.result,
              total: result.total,
              time: result.time
            };
          } catch (retryError) {
            logger.error('Bitrix24 API call failed after token refresh', {
              method,
              error: retryError.message,
              response: retryError.response?.data,
              status: retryError.response?.status
            });
          }
        } else {
          logger.error('Failed to refresh access token', {
            method,
            error: refreshResult.error
          });
        }
      }

      logger.error('Bitrix24 API call failed', {
        method,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Test connection to Bitrix24
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      if (!this.accessToken) {
        return {
          success: false,
          error: 'No access token available',
          message: 'Please complete OAuth2 authorization first'
        };
      }

      const result = await this.makeApiCall('user.current');
      
      if (result.success) {
        return {
          success: true,
          message: 'Connection successful',
          user: result.result
        };
      } else {
        return {
          success: false,
          error: result.error,
          message: 'Failed to connect to Bitrix24'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Connection test failed'
      };
    }
  }

  /**
   * Generate state parameter for OAuth2
   * @returns {string} Random state string
   */
  generateState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get current access token
   * @returns {string|null} Access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Set access token manually
   * @param {string} token - Access token
   * @param {string} refreshToken - Refresh token
   */
  setTokens(token, refreshToken = null) {
    this.accessToken = token;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    
    logger.info('Tokens updated manually', {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken
    });
  }
}

module.exports = Bitrix24OAuth;
