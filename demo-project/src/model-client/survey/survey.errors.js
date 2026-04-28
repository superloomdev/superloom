// Info: Error catalog for Survey client model
// Pattern: Plain object export (no loader needed)
'use strict';

module.exports = {

  CACHE_MISS: {
    code: 'SURVEY_CACHE_MISS',
    message: 'Survey not found in local cache',
    status: 404
  },

  CACHE_EXPIRED: {
    code: 'SURVEY_CACHE_EXPIRED',
    message: 'Cached survey data has expired',
    status: 410
  },

  SYNC_CONFLICT: {
    code: 'SURVEY_SYNC_CONFLICT',
    message: 'Survey data conflict during sync',
    status: 409
  }

};
