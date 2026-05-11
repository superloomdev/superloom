'use strict';

/**
 * Error catalog for js-server-helper-sql-postgres.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  DATABASE_CONNECTION_FAILED: Object.freeze({
    type: 'DATABASE_CONNECTION_FAILED',
    message: 'Database connection failed'
  }),

  DATABASE_QUERY_FAILED: Object.freeze({
    type: 'DATABASE_QUERY_FAILED',
    message: 'Database query execution failed'
  }),

  DATABASE_TRANSACTION_FAILED: Object.freeze({
    type: 'DATABASE_TRANSACTION_FAILED',
    message: 'Database transaction failed'
  })

});
