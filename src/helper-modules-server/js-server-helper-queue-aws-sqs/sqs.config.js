// Info: Configuration for js-server-helper-queue-aws-sqs
// All values can be overridden via loader config injection
'use strict';


module.exports = {

  // AWS Region
  REGION: 'us-east-1',

  // AWS Credentials (injected via loader from environment)
  KEY: undefined,
  SECRET: undefined,

  // Custom endpoint for ElasticMQ (e.g., 'http://localhost:9324')
  // Leave undefined for real AWS SQS
  ENDPOINT: undefined,

  // Queue URL prefix (optional). If set, queue names are appended to this
  // Example: 'https://sqs.us-east-1.amazonaws.com/123456789012/'
  QUEUE_URL_PREFIX: undefined,

  // Default visibility timeout in seconds
  DEFAULT_VISIBILITY_TIMEOUT: 30,

  // Maximum retry attempts for failed requests
  MAX_RETRIES: 3

};
