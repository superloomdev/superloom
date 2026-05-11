// Info: Configuration file for js-server-helper-aws-s3-url-signer
'use strict';


module.exports = {

  // AWS Region for S3
  REGION: 'us-east-1',

  // Default upload URL expiry (15 minutes)
  UPLOAD_URL_EXPIRY: 900,

  // Default download URL expiry (1 hour)
  DOWNLOAD_URL_EXPIRY: 3600,

  // AWS credentials (explicit, not implicit)
  KEY: undefined,
  SECRET: undefined,

  // Custom endpoint (for MinIO/LocalStack)
  ENDPOINT: undefined,

  // Force path-style addressing (required for MinIO)
  FORCE_PATH_STYLE: false

};
