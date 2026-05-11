'use strict';

/**
 * Error catalog for js-server-helper-nosql-aws-dynamodb.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  DATABASE_WRITE_FAILED: Object.freeze({
    type: 'DATABASE_WRITE_FAILED',
    message: 'Database write operation failed'
  }),

  DATABASE_READ_FAILED: Object.freeze({
    type: 'DATABASE_READ_FAILED',
    message: 'Database read operation failed'
  }),

  DATABASE_UPDATE_FAILED: Object.freeze({
    type: 'DATABASE_UPDATE_FAILED',
    message: 'Database update operation failed'
  }),

  DATABASE_DELETE_FAILED: Object.freeze({
    type: 'DATABASE_DELETE_FAILED',
    message: 'Database delete operation failed'
  }),

  DATABASE_QUERY_FAILED: Object.freeze({
    type: 'DATABASE_QUERY_FAILED',
    message: 'Database query operation failed'
  }),

  DATABASE_SCAN_FAILED: Object.freeze({
    type: 'DATABASE_SCAN_FAILED',
    message: 'Database scan operation failed'
  }),

  DATABASE_BATCH_FAILED: Object.freeze({
    type: 'DATABASE_BATCH_FAILED',
    message: 'Database batch operation failed'
  }),

  DATABASE_TRANSACTION_FAILED: Object.freeze({
    type: 'DATABASE_TRANSACTION_FAILED',
    message: 'Database transaction failed'
  }),

  DATABASE_TABLE_CREATE_FAILED: Object.freeze({
    type: 'DATABASE_TABLE_CREATE_FAILED',
    message: 'Database table creation failed'
  }),

  DATABASE_TABLE_DELETE_FAILED: Object.freeze({
    type: 'DATABASE_TABLE_DELETE_FAILED',
    message: 'Database table deletion failed'
  })

});
