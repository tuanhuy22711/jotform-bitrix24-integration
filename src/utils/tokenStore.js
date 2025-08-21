const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class TokenStore {
  constructor() {
    this.tokenFile = path.join(__dirname, '../../data/tokens.json');
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.tokenFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Save tokens to file
   * @param {Object} tokenData - Token data to save
   */
  saveTokens(tokenData) {
    try {
      const data = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresIn: tokenData.expiresIn,
        scope: tokenData.scope,
        domain: tokenData.domain,
        memberId: tokenData.memberId,
        status: tokenData.status,
        clientEndpoint: tokenData.clientEndpoint,
        serverEndpoint: tokenData.serverEndpoint,
        applicationToken: tokenData.applicationToken,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (parseInt(tokenData.expiresIn) * 1000)).toISOString()
      };

      fs.writeFileSync(this.tokenFile, JSON.stringify(data, null, 2));
      
      logger.info('💾 TOKENS SAVED TO FILE', {
        domain: data.domain,
        expiresAt: data.expiresAt,
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken
      });

      return true;
    } catch (error) {
      logger.error('❌ FAILED TO SAVE TOKENS', {
        error: error.message,
        tokenFile: this.tokenFile
      });
      return false;
    }
  }

  /**
   * Load tokens from file
   * @returns {Object|null} Token data or null if not found
   */
  loadTokens() {
    try {
      if (!fs.existsSync(this.tokenFile)) {
        logger.info('📁 NO TOKEN FILE FOUND', { tokenFile: this.tokenFile });
        return null;
      }

      const data = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
      
      // Check if we have valid token data
      if (!data || Object.keys(data).length === 0 || !data.accessToken) {
        logger.info('📁 NO VALID TOKENS IN FILE');
        return null;
      }
      
      // Check if token is expired
      const now = new Date();
      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      
      if (expiresAt && now > expiresAt) {
        logger.warn('⏰ TOKEN EXPIRED', {
          expiresAt: data.expiresAt,
          now: now.toISOString()
        });
        // Don't return null, still return data so we can try to refresh
      }

      logger.info('📖 TOKENS LOADED FROM FILE', {
        domain: data.domain,
        expiresAt: data.expiresAt,
        isExpired: expiresAt ? now > expiresAt : false,
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken
      });

      return data;
    } catch (error) {
      logger.error('❌ FAILED TO LOAD TOKENS', {
        error: error.message,
        tokenFile: this.tokenFile
      });
      return null;
    }
  }

  /**
   * Clear saved tokens
   */
  clearTokens() {
    try {
      if (fs.existsSync(this.tokenFile)) {
        fs.unlinkSync(this.tokenFile);
        logger.info('🗑️ TOKENS CLEARED FROM FILE');
      }
      return true;
    } catch (error) {
      logger.error('❌ FAILED TO CLEAR TOKENS', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if tokens exist and are valid
   * @returns {boolean}
   */
  hasValidTokens() {
    const tokens = this.loadTokens();
    if (!tokens || !tokens.accessToken) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(tokens.expiresAt);
    
    return now < expiresAt;
  }
}

module.exports = new TokenStore();
