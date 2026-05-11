'use strict';

/**
 * Error catalog for js-server-helper-auth.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  SERVICE_UNAVAILABLE: Object.freeze({
    type: 'AUTH_SERVICE_UNAVAILABLE',
    message: 'Authentication service temporarily unavailable'
  }),

  LIMIT_REACHED: Object.freeze({
    type: 'AUTH_LIMIT_REACHED',
    message: 'Maximum number of active sessions reached for this actor'
  }),

  INVALID_TOKEN: Object.freeze({
    type: 'AUTH_INVALID_TOKEN',
    message: 'Invalid or malformed authentication token'
  }),

  SESSION_EXPIRED: Object.freeze({
    type: 'AUTH_SESSION_EXPIRED',
    message: 'Session has expired - please sign in again'
  }),

  ACTOR_TYPE_MISMATCH: Object.freeze({
    type: 'AUTH_ACTOR_TYPE_MISMATCH',
    message: 'Token actor type does not match expected type'
  }),

  NOT_IMPLEMENTED: Object.freeze({
    type: 'NOT_IMPLEMENTED',
    message: 'This operation is not yet implemented for this backend'
  })

});
