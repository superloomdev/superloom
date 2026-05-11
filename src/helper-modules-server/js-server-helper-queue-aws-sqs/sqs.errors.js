'use strict';

/**
 * Error catalog for js-server-helper-queue-aws-sqs.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  QUEUE_SEND_FAILED: Object.freeze({
    type: 'QUEUE_SEND_FAILED',
    message: 'Queue message send failed'
  }),

  QUEUE_RECEIVE_FAILED: Object.freeze({
    type: 'QUEUE_RECEIVE_FAILED',
    message: 'Queue message receive failed'
  }),

  QUEUE_DELETE_FAILED: Object.freeze({
    type: 'QUEUE_DELETE_FAILED',
    message: 'Queue message delete failed'
  })

});
