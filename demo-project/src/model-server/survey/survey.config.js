// Info: Server-only config for Survey entity
// Pattern: Plain object export (no loader needed)
'use strict';

module.exports = {

  // Publication rules
  MAX_PUBLISHED_SURVEYS_PER_USER: 10,

  // Quota limits
  MAX_RESPONSES_PER_SURVEY: 10000,

  // Versioning
  DEFAULT_VERSION: 1,

  // Status transitions
  PUBLISHABLE_STATUSES: ['draft', 'closed']

};
