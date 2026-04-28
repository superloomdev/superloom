// Info: Cleanup helper for SQL backends (Postgres / MySQL / SQLite).
// Use this when the backend has no native TTL (or when you want bounded
// table size between sweeps).
//
// Native TTL is the preferred mechanism where available:
//   DynamoDB - native TTL on `expires_at` (sweeps within 48h, free)
//   MongoDB  - native TTL index on `_ttl` (sweeps every ~60s, free)
//   Postgres - no native TTL; use this helper, pg_cron, or external scheduler
//   MySQL    - no native TTL; use this helper, MySQL EVENT scheduler, or external
//   SQLite   - no native TTL, no scheduler; use this helper from setInterval / cron
//
// The verify module itself never depends on cleanup running. The consume-time
// `instance.time > record.expires_at` check guarantees correctness regardless of
// whether expired rows are still in the table. Cleanup is a storage-hygiene
// concern, not a security concern.
'use strict';



/********************************************************************
Delete every verification record whose `expires_at` is in the past.

Designed to be invoked from:
  - A cron job (Linux: `* * * * * node /path/to/cleanup-cron.js`)
  - A serverless scheduled trigger (CloudWatch Events, Cloud Scheduler)
  - An in-process setInterval (single-instance Node servers)
  - A MySQL EVENT scheduler (the EVENT body becomes
    `DELETE FROM verification_codes WHERE expires_at < UNIX_TIMESTAMP()`)
  - A Postgres pg_cron job (the cron body becomes
    `DELETE FROM verification_codes WHERE expires_at < extract(epoch from now())`)

@param {Object} Sql - Loaded SQL helper instance (Postgres, MySQL, or SQLite)
@param {Object} instance - Request instance for performance tracing
@param {Object} options - Cleanup config
@param {String} options.table - Table name (e.g. 'verification_codes')
@param {Number} [options.before_epoch] - Delete records with expires_at < this
                                         Unix epoch (defaults to now)

@return {Promise<Object>} - { success, deleted_count, error }
*********************************************************************/
module.exports = async function cleanupExpiredSqlRecords (Sql, instance, options) {

  const table = options.table;
  const before_epoch = (options.before_epoch !== undefined)
    ? options.before_epoch
    : Math.floor(Date.now() / 1000);

  // Plain DELETE WHERE expires_at < ? - the index on expires_at makes this fast even on big tables
  // No identifier quoting: caller is expected to pass a reserved-word-free table name
  const result = await Sql.write(
    instance,
    'DELETE FROM ' + table + ' WHERE expires_at < ?',
    [before_epoch]
  );

  if (result.success === false) {
    return {
      success: false,
      deleted_count: 0,
      error: result.error
    };
  }

  return {
    success: true,
    deleted_count: result.affected_rows || 0,
    error: null
  };

};
