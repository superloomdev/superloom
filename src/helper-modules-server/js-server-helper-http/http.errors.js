'use strict';

/**
 * Error catalog for js-server-helper-http.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  NETWORK_REQUEST_FAILED: Object.freeze({
    type: 'NETWORK_REQUEST_FAILED',
    message: 'Network request failed'
  }),

  NETWORK_TIMEOUT: Object.freeze({
    type: 'NETWORK_TIMEOUT',
    message: 'Network request timed out'
  }),

  NETWORK_SETUP_FAILED: Object.freeze({
    type: 'NETWORK_SETUP_FAILED',
    message: 'Network request setup failed'
  })

});
