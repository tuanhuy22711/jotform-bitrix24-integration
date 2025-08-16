const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Create logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // File transport
    new winston.transports.File({
      filename: path.join(process.cwd(), config.logging.file),
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs/error.log'),
      level: 'error',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true
    })
  ]
});

// Add request logging method
logger.logRequest = (req, res, duration) => {
  const { method, url, ip, headers } = req;
  const { statusCode } = res;
  
  logger.info('HTTP Request', {
    method,
    url,
    ip,
    statusCode,
    duration: `${duration}ms`,
    userAgent: headers['user-agent'],
    contentLength: headers['content-length']
  });
};

// Add API call logging method
logger.logApiCall = (service, endpoint, method, statusCode, duration, error = null) => {
  const logData = {
    service,
    endpoint,
    method,
    statusCode,
    duration: `${duration}ms`
  };
  
  if (error) {
    logger.error(`API call failed to ${service}`, { ...logData, error: error.message });
  } else {
    logger.info(`API call to ${service}`, logData);
  }
};

// Add webhook logging method
logger.logWebhook = (source, action, data, success = true, error = null) => {
  const logData = {
    source,
    action,
    dataKeys: Object.keys(data || {}),
    timestamp: new Date().toISOString()
  };
  
  if (success) {
    logger.info(`Webhook processed: ${source} -> ${action}`, logData);
  } else {
    logger.error(`Webhook failed: ${source} -> ${action}`, { ...logData, error: error?.message });
  }
};

module.exports = logger;
