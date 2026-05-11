// Info: Configuration defaults for js-server-helper-logger.
// Most fields are required at construction time and validated by the loader.
// Keys with a default of `null` mean "must be supplied by the project" -
// the loader throws if they are still null.
'use strict';


module.exports = {

  // Store factory function. Pass the result of require() for the chosen
  // adapter package - the same way you pass Lib.Postgres / Lib.MongoDB.
  //   STORE: require('@superloomdev/js-server-helper-logger-store-sqlite')
  //   STORE: require('@superloomdev/js-server-helper-logger-store-postgres')
  //   STORE: require('@superloomdev/js-server-helper-logger-store-mysql')
  //   STORE: require('@superloomdev/js-server-helper-logger-store-mongodb')
  //   STORE: require('@superloomdev/js-server-helper-logger-store-dynamodb')
  // Required.
  STORE: null,

  // Per-store configuration. Shape varies by STORE - the chosen store's
  // factory validates its own required keys.
  //   sqlite/postgres/mysql: { table_name: 'action_log', lib_sql: Lib.SQLite }
  //   dynamodb:              { table_name: 'action_log', lib_dynamodb: Lib.DynamoDB }
  //   mongodb:               { collection_name: 'action_log', lib_mongodb: Lib.MongoDB }
  // Required.
  STORE_CONFIG: null,

  // Optional symmetric key for IP-address encryption at rest. When set,
  // `log()` runs each IP through `Lib.Crypto.aesEncrypt(ip, key)` before
  // storage and `listBy*` decrypts on the way out. Leave `null` to store
  // plaintext IPs (some deployments do fraud detection or geo-IP lookups
  // and need the raw value).
  IP_ENCRYPT_KEY: null

};
