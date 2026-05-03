// Info: Configuration defaults for js-server-helper-logger.
// STORE + STORE_CONFIG + ERRORS are required; everything else is optional.
'use strict';


module.exports = {

  // Storage backend name. One of:
  //   'memory' | 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'dynamodb'
  STORE: null,

  // Per-backend config object. Shape varies - see README.md for each store.
  // Memory takes an empty object; SQL stores need `{ table_name, lib_sql }`;
  // MongoDB needs `{ collection_name, lib_mongodb }`; DynamoDB needs
  // `{ table_name, lib_dynamodb }`.
  STORE_CONFIG: null,

  // Domain error catalog. Every failure path returns one of these verbatim
  // so the controller can `return { success: false, error: result.error }`
  // without inspecting the cause. Required keys:
  //   STORE_READ_FAILED   - listByEntity/listByActor/cleanup failed
  //   STORE_WRITE_FAILED  - addRecord failed (surfaced only when options.await is true)
  // Each value is whatever shape your application uses (typically
  // `{ code, message, status }` from your `[entity].errors.js`).
  ERRORS: null,

  // Optional symmetric key for IP-address encryption at rest. When set,
  // `log()` runs each IP through `Lib.Crypto.aesEncrypt(ip, key)` before
  // storage and `listBy*` decrypts on the way out. Leave `null` to store
  // plaintext IPs (some deployments do fraud detection or geo-IP lookups
  // and need the raw value).
  IP_ENCRYPT_KEY: null

};
