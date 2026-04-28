// Test loader for js-server-helper-aws-s3-url-signer
'use strict';

// Mock Utils and Debug for testing
const Utils = {
  isString: (val) => typeof val === 'string',
  isObject: (val) => val !== null && typeof val === 'object',
  isEmpty: (val) => val == null || val === ''
};

const Debug = {
  log: (message, data) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },
  debug: (message, data) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }
};

const Config = {
  REGION: process.env.S3_REGION || 'us-east-1',
  KEY: process.env.S3_ACCESS_KEY,
  SECRET: process.env.S3_SECRET_KEY,
  ENDPOINT: process.env.S3_ENDPOINT,
  FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === 'true',
  UPLOAD_URL_EXPIRY: 900,
  DOWNLOAD_URL_EXPIRY: 3600
};

module.exports = {
  Lib: {
    Utils,
    Debug
  },
  Config
};
