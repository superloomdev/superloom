'use strict';

/**
 * Error catalog for js-server-helper-verify.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  COOLDOWN_ACTIVE: Object.freeze({
    type: 'VERIFY_COOLDOWN_ACTIVE',
    message: 'Rate limit active - wait before requesting another code'
  }),

  NOT_FOUND: Object.freeze({
    type: 'VERIFY_NOT_FOUND',
    message: 'Verification code not found or already consumed'
  }),

  EXPIRED: Object.freeze({
    type: 'VERIFY_EXPIRED',
    message: 'Verification code has expired'
  }),

  MAX_FAILS: Object.freeze({
    type: 'VERIFY_MAX_FAILS',
    message: 'Too many failed verification attempts - code locked'
  }),

  WRONG_VALUE: Object.freeze({
    type: 'VERIFY_WRONG_VALUE',
    message: 'Verification code does not match'
  }),

  SERVICE_UNAVAILABLE: Object.freeze({
    type: 'VERIFY_SERVICE_UNAVAILABLE',
    message: 'Verification service temporarily unavailable'
  })

});
