const axios = require('axios');
const logger = require('../utils/logger');

/**
 * HTTP service wrapper for making HTTP requests
 */
class HttpService {
  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          dataKeys: config.data ? Object.keys(config.data) : []
        });
        return config;
      },
      (error) => {
        logger.error('HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('HTTP Response', {
          status: response.status,
          url: response.config.url,
          hasData: !!response.data
        });
        return response;
      },
      (error) => {
        logger.error('HTTP Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make GET request
   */
  async get(url, config) {
    try {
      return await this.axiosInstance.get(url, config);
    } catch (error) {
      logger.error('GET request failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Make POST request
   */
  async post(url, data, config) {
    try {
      return await this.axiosInstance.post(url, data, config);
    } catch (error) {
      logger.error('POST request failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Make PUT request
   */
  async put(url, data, config) {
    try {
      return await this.axiosInstance.put(url, data, config);
    } catch (error) {
      logger.error('PUT request failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Make DELETE request
   */
  async delete(url, config) {
    try {
      return await this.axiosInstance.delete(url, config);
    } catch (error) {
      logger.error('DELETE request failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Make PATCH request
   */
  async patch(url, data, config) {
    try {
      return await this.axiosInstance.patch(url, data, config);
    } catch (error) {
      logger.error('PATCH request failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Create axios instance with custom config
   */
  create(config) {
    return axios.create(config);
  }

  /**
   * Get the underlying axios instance
   */
  getAxiosInstance() {
    return this.axiosInstance;
  }
}

module.exports = HttpService;
