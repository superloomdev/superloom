'use strict';

/**
 * Error catalog for js-server-helper-http-gateway.
 * Operational errors returned via { success: false, error }.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  INVALID_PARAM: Object.freeze({
    type: 'HTTP_GATEWAY_INVALID_PARAM',
    message: 'One or more required request parameters are missing or invalid'
  }),

  NOT_IMPLEMENTED: Object.freeze({
    type: 'NOT_IMPLEMENTED',
    message: 'This operation is not yet implemented for this adapter'
  })

});
