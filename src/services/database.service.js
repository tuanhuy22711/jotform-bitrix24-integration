const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Database service for token management
 * Currently uses file-based storage, can be replaced with real database
 */
class DatabaseService {
  constructor() {
    this.tokenFile = path.join(__dirname, '../../data/tokens.json');
    this.dataDir = path.dirname(this.tokenFile);
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Save token to database (file-based for now)
   */
  async saveToken(tokenData) {
    try {
      const data = {
        ...tokenData,
        id: Date.now(), // Simple ID generation
        created_at: tokenData.created_at.toISOString(),
        updated_at: tokenData.updated_at.toISOString()
      };

      fs.writeFileSync(this.tokenFile, JSON.stringify(data, null, 2));
      
      logger.info('💾 Token saved to database', {
        domain: data.domain,
        expiresAt: data.expires_at,
        method: data.method
      });

      return true;
    } catch (error) {
      logger.error('❌ Failed to save token to database', {
        error: error.message,
        tokenFile: this.tokenFile
      });
      return false;
    }
  }

  /**
   * Get current token from database
   */
  async getCurrentToken() {
    try {
      if (!fs.existsSync(this.tokenFile)) {
        logger.log('📁 No token file found in database');
        return null;
      }

      const data = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
      
      // Convert string dates back to Date objects
      const token = {
        ...data,
        expires_at: new Date(data.expires_at),
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

      // Check if token is expired
      const now = new Date();
      if (now > token.expires_at) {
        logger.warn('⏰ Token in database is expired', {
          expiresAt: token.expires_at,
          now: now.toISOString()
        });
      }

      logger.info('📖 Token loaded from database', {
        domain: token.domain,
        expiresAt: token.expires_at,
        isExpired: now > token.expires_at,
        method: token.method
      });

      return token;
    } catch (error) {
      logger.error('❌ Failed to load token from database', {
        error: error.message,
        tokenFile: this.tokenFile
      });
      return null;
    }
  }

  /**
   * Update existing token in database
   */
  async updateToken(id, updates) {
    try {
      const currentToken = await this.getCurrentToken();
      if (!currentToken) {
        logger.warn('⚠️ No current token to update');
        return false;
      }

      const updatedToken = {
        ...currentToken,
        ...updates,
        updated_at: new Date()
      };

      return await this.saveToken(updatedToken);
    } catch (error) {
      logger.error('❌ Failed to update token in database', {
        error: error.message,
        tokenId: id
      });
      return false;
    }
  }

  /**
   * Delete token from database
   */
  async deleteToken(id) {
    try {
      if (fs.existsSync(this.tokenFile)) {
        fs.unlinkSync(this.tokenFile);
        logger.log('🗑️ Token deleted from database', { tokenId: id });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Failed to delete token from database', {
        error: error.message,
        tokenId: id
      });
      return false;
    }
  }

  /**
   * Get all tokens (for admin purposes)
   */
  async getAllTokens() {
    try {
      const currentToken = await this.getCurrentToken();
      return currentToken ? [currentToken] : [];
    } catch (error) {
      logger.error('❌ Failed to get all tokens from database', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Clear all tokens (for reset purposes)
   */
  async clearAllTokens() {
    try {
      return await this.deleteToken(0); // Simple approach for file-based storage
    } catch (error) {
      logger.error('❌ Failed to clear all tokens from database', {
        error: error.message
      });
      return false;
    }
  }
}

module.exports = DatabaseService;
