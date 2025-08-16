const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class Bitrix24OAuth {
  constructor() {
    this.clientId = config.bitrix24.clientId;
    this.clientSecret = config.bitrix24.clientSecret;
    this.domain = config.bitrix24.domain;
    this.redirectUri = config.bitrix24.redirectUri;
    this.accessToken = config.bitrix24.accessToken;
    this.refreshToken = config.bitrix24.refreshToken;
  }

  /**
   * Get OAuth2 authorization URL
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'crm',
      state: this.generateState()
    });

    const authUrl = `https://${this.domain}/oauth/authorize/?${params.toString()}`;
    
    logger.info('Generated OAuth2 authorization URL', {
      url: authUrl,
      clientId: this.clientId,
      redirectUri: this.redirectUri
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code) {
    try {
      const tokenUrl = `https://${this.domain}/oauth/token/`;
      
      const params = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code
      };

      logger.info('Exchanging authorization code for token', {
        tokenUrl,
        clientId: this.clientId,
        hasCode: !!code
      });

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: config.bitrix24.timeout
      });

      const tokenData = response.data;
      
      logger.info('Token exchange successful', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      });

      // Store tokens (in production, save to database)
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        domain: tokenData.domain || this.domain
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

      const tokenUrl = `https://${this.domain}/oauth/token/`;
      
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

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: config.bitrix24.timeout
      });

      const tokenData = response.data;
      
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

      const apiUrl = `https://${this.domain}/rest/${method}.json`;
      
      const requestData = {
        ...params,
        auth: this.accessToken
      };

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
        timeout: config.bitrix24.timeout
      });

      const result = response.data;

      if (result.error) {
        // Check if token is expired
        if (result.error === 'expired_token' || result.error === 'invalid_token') {
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
