// Info: Configuration file for Debug module
'use strict';


// Export configuration as key-value Map
module.exports = {

  // Log level threshold: 'debug' | 'info' | 'warn' | 'error' | 'none'
  // Only messages at or above this level will be logged
  // Order: debug < info < warn < error < none
  LOG_LEVEL: 'debug',

  // Output format: 'text' | 'json'
  // 'text' - Human-readable format for local development and Docker stdout
  // 'json' - Structured JSON format for CloudWatch, log aggregators, and machine parsing
  LOG_FORMAT: 'text',

  // Whether to include stack traces in error logs
  INCLUDE_STACK_TRACE: true,

  // Whether to include memory usage in audit logs
  INCLUDE_MEMORY_USAGE: true,

  // Application name (included in structured logs for filtering)
  APP_NAME: 'app',

  // Environment identifier (included in structured logs)
  ENVIRONMENT: 'development'

};
