// Info: Client-only config for Survey entity
// Pattern: Plain object export (no loader needed)
'use strict';

module.exports = {

  // Cache TTL in milliseconds (5 minutes)
  CACHE_TTL_MS: 5 * 60 * 1000,

  // Sync status values
  SYNC_STATUS_PENDING: 'pending',
  SYNC_STATUS_SYNCED: 'synced',
  SYNC_STATUS_CONFLICT: 'conflict'

};
