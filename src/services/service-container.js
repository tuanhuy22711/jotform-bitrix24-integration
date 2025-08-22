const ConfigService = require('./config.service');
const HttpService = require('./http.service');
const DatabaseService = require('./database.service');
const Bitrix24NewService = require('./bitrix24-new.service');

/**
 * Simple service container for dependency injection
 * In a real NestJS app, this would be handled by the framework
 */
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  static getInstance() {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async initializeServices() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize services in dependency order
      const configService = new ConfigService();
      this.services.set('ConfigService', configService);

      const httpService = new HttpService();
      this.services.set('HttpService', httpService);

      const databaseService = new DatabaseService();
      // Wait for database initialization
      await databaseService.initDatabase();
      this.services.set('DatabaseService', databaseService);

      const bitrix24Service = new Bitrix24NewService(
        configService,
        httpService,
        databaseService
      );
      this.services.set('Bitrix24NewService', bitrix24Service);

      this.initialized = true;
      console.log('✅ Service container initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize service container:', error.message);
      throw error;
    }
  }

  async get(serviceName) {
    if (!this.initialized) {
      await this.initializeServices();
    }
    
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }
    return service;
  }

  has(serviceName) {
    return this.services.has(serviceName);
  }

  getAllServices() {
    return Array.from(this.services.keys());
  }

  /**
   * Get Bitrix24 service instance
   */
  async getBitrix24Service() {
    return await this.get('Bitrix24NewService');
  }

  /**
   * Get Config service instance
   */
  async getConfigService() {
    return await this.get('ConfigService');
  }

  /**
   * Get Database service instance
   */
  async getDatabaseService() {
    return await this.get('DatabaseService');
  }

  /**
   * Get HTTP service instance
   */
  async getHttpService() {
    return await this.get('HttpService');
  }
}

module.exports = { ServiceContainer };
