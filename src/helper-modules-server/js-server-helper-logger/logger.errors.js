'use strict';

/**
 * Error catalog for js-server-helper-logger.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  SERVICE_UNAVAILABLE: Object.freeze({
    type: 'LOGGER_SERVICE_UNAVAILABLE',
    message: 'Logger service temporarily unavailable'
  })

});
