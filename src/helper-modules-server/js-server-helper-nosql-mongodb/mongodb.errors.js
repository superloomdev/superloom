'use strict';

/**
 * Error catalog for js-server-helper-nosql-mongodb.
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

  DATABASE_BATCH_GET_FAILED: Object.freeze({
    type: 'DATABASE_BATCH_GET_FAILED',
    message: 'Database batch get operation failed'
  }),

  DATABASE_BATCH_WRITE_FAILED: Object.freeze({
    type: 'DATABASE_BATCH_WRITE_FAILED',
    message: 'Database batch write operation failed'
  }),

  DATABASE_BATCH_DELETE_FAILED: Object.freeze({
    type: 'DATABASE_BATCH_DELETE_FAILED',
    message: 'Database batch delete operation failed'
  }),

  DATABASE_BATCH_WRITE_DELETE_FAILED: Object.freeze({
    type: 'DATABASE_BATCH_WRITE_DELETE_FAILED',
    message: 'Database batch write/delete operation failed'
  }),

  DATABASE_TRANSACTION_FAILED: Object.freeze({
    type: 'DATABASE_TRANSACTION_FAILED',
    message: 'Database transaction failed'
  }),

  DATABASE_QUERY_FAILED: Object.freeze({
    type: 'DATABASE_QUERY_FAILED',
    message: 'Database query operation failed'
  })

});
