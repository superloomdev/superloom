// Info: Static configuration defaults for the server application
'use strict';


// Export static configuration as key-value Map
module.exports = {

  // Server settings
  PORT: 3000,
  NODE_ENV: 'development',

  // Debug module configuration (keys match @superloomdev/js-helper-debug config)
  debug: {
    LOG_LEVEL: 'debug',
    LOG_FORMAT: 'text',
    INCLUDE_STACK_TRACE: true,
    INCLUDE_MEMORY_USAGE: true,
    APP_NAME: 'demo-project',
    ENVIRONMENT: 'development'
  },

  // Database configuration (overridden by environment variables)
  database: {
    host: 'localhost',
    port: 5432,
    name: 'app_db',
    user: 'app_user',
    password: ''
  },

  // AWS S3 configuration (overridden by environment variables)
  aws_s3: {
    region: 'us-east-1',
    bucket: ''
  },

  // Auth configuration
  auth: {
    token_secret: '',
    token_expiry: 3600
  }

};
