const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

/**
 * Database service for token management using SQLite
 */
class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/tokens.db');
    this.dataDir = path.dirname(this.dbPath);
    this.ensureDataDirectory();
    this.initDatabase();
  }

  ensureDataDirectory() {
    if (!require('fs').existsSync(this.dataDir)) {
      require('fs').mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Initialize SQLite database and create tables
   */
  initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('❌ Failed to connect to SQLite database', {
            error: err.message,
            dbPath: this.dbPath
          });
          reject(err);
          return;
        }

        logger.info('🔗 Connected to SQLite database', { dbPath: this.dbPath });

        // Create tokens table if it doesn't exist
        this.createTables()
          .then(() => {
            logger.info('✅ Database tables initialized successfully');
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Create necessary database tables
   */
  createTables() {
    return new Promise((resolve, reject) => {
      const createTokensTable = `
        CREATE TABLE IF NOT EXISTS tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_in INTEGER,
          expires_at TEXT,
          domain TEXT NOT NULL,
          scope TEXT,
          client_endpoint TEXT,
          server_endpoint TEXT,
          member_id TEXT,
          status TEXT,
          application_token TEXT,
          method TEXT NOT NULL DEFAULT 'oauth2',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `;

      this.db.run(createTokensTable, (err) => {
        if (err) {
          logger.error('❌ Failed to create tokens table', { error: err.message });
          reject(err);
          return;
        }

        // Create index for faster queries
        const createIndex = `CREATE INDEX IF NOT EXISTS idx_tokens_domain_method ON tokens(domain, method)`;
        this.db.run(createIndex, (err) => {
          if (err) {
            logger.warn('⚠️ Failed to create index', { error: err.message });
            // Don't fail if index creation fails
          }
          resolve();
        });
      });
    });
  }

  /**
   * Save token to database
   */
  async saveToken(tokenData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tokens (
          access_token, refresh_token, expires_in, expires_at, domain, scope,
          client_endpoint, server_endpoint, member_id, status, application_token,
          method, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        tokenData.access_token,
        tokenData.refresh_token || null,
        tokenData.expires_in || null,
        tokenData.expires_at ? tokenData.expires_at.toISOString() : null,
        tokenData.domain,
        tokenData.scope || null,
        tokenData.client_endpoint || null,
        tokenData.server_endpoint || null,
        tokenData.member_id || null,
        tokenData.status || null,
        tokenData.application_token || null,
        tokenData.method || 'oauth2',
        tokenData.created_at.toISOString(),
        tokenData.updated_at.toISOString()
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('❌ Failed to save token to database', {
            error: err.message,
            domain: tokenData.domain
          });
          reject(err);
          return;
        }

        logger.info('💾 Token saved to database', {
          id: this.lastID,
          domain: tokenData.domain,
          method: tokenData.method
        });

        resolve(this.lastID);
      });
    });
  }

  /**
   * Get current token from database (most recent)
   */
  async getCurrentToken() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tokens 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      this.db.get(sql, (err, row) => {
        if (err) {
          logger.error('❌ Failed to get current token from database', {
            error: err.message
          });
          reject(err);
          return;
        }

        if (!row) {
          logger.info('📁 No token found in database');
          resolve(null);
          return;
        }

        // Convert string dates back to Date objects
        const token = {
          ...row,
          expires_at: row.expires_at ? new Date(row.expires_at) : null,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        };

        // Check if token is expired (only for tokens with expiration dates)
        const now = new Date();
        if (token.expires_at && now > token.expires_at) {
          logger.warn('⏰ Token in database is expired', {
            expiresAt: token.expires_at,
            now: now.toISOString()
          });
        }

        logger.info('📖 Token loaded from database', {
          id: token.id,
          domain: token.domain,
          method: token.method,
          expiresAt: token.expires_at,
          isExpired: token.expires_at ? now > token.expires_at : false
        });

        resolve(token);
      });
    });
  }

  /**
   * Get token by domain and method
   */
  async getTokenByDomain(domain, method = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM tokens WHERE domain = ?';
      let params = [domain];

      if (method) {
        sql += ' AND method = ?';
        params.push(method);
      }

      sql += ' ORDER BY created_at DESC LIMIT 1';

      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('❌ Failed to get token by domain', {
            error: err.message,
            domain,
            method
          });
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        // Convert string dates back to Date objects
        const token = {
          ...row,
          expires_at: row.expires_at ? new Date(row.expires_at) : null,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        };

        resolve(token);
      });
    });
  }

  /**
   * Update existing token in database
   */
  async updateToken(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      // Build dynamic update query
      Object.keys(updates).forEach(key => {
        if (key !== 'id') { // Don't update the ID
          fields.push(`${key} = ?`);
          if (key === 'expires_at' && updates[key] instanceof Date) {
            params.push(updates[key].toISOString());
          } else if (key === 'updated_at') {
            params.push(new Date().toISOString());
          } else {
            params.push(updates[key]);
          }
        }
      });

      if (fields.length === 0) {
        resolve(false);
        return;
      }

      const sql = `UPDATE tokens SET ${fields.join(', ')} WHERE id = ?`;
      params.push(id);

      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('❌ Failed to update token in database', {
            error: err.message,
            tokenId: id
          });
          reject(err);
          return;
        }

        logger.info('✅ Token updated in database', {
          tokenId: id,
          changes: this.changes
        });

        resolve(this.changes > 0);
      });
    });
  }

  /**
   * Delete token from database
   */
  async deleteToken(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM tokens WHERE id = ?';

      this.db.run(sql, [id], function(err) {
        if (err) {
          logger.error('❌ Failed to delete token from database', {
            error: err.message,
            tokenId: id
          });
          reject(err);
          return;
        }

        logger.info('🗑️ Token deleted from database', { 
          tokenId: id,
          changes: this.changes
        });

        resolve(this.changes > 0);
      });
    });
  }

  /**
   * Get all tokens (for admin purposes)
   */
  async getAllTokens() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM tokens ORDER BY created_at DESC';

      this.db.all(sql, (err, rows) => {
        if (err) {
          logger.error('❌ Failed to get all tokens from database', {
            error: err.message
          });
          reject(err);
          return;
        }

        // Convert string dates back to Date objects
        const tokens = rows.map(row => ({
          ...row,
          expires_at: row.expires_at ? new Date(row.expires_at) : null,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        }));

        resolve(tokens);
      });
    });
  }

  /**
   * Clear all tokens (for reset purposes)
   */
  async clearAllTokens() {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM tokens';

      this.db.run(sql, (err) => {
        if (err) {
          logger.error('❌ Failed to clear all tokens from database', {
            error: err.message
          });
          reject(err);
          return;
        }

        logger.info('🗑️ All tokens cleared from database');
        resolve(true);
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('❌ Error closing database connection', { error: err.message });
        } else {
          logger.info('🔒 Database connection closed');
        }
      });
    }
  }
}

module.exports = DatabaseService;
