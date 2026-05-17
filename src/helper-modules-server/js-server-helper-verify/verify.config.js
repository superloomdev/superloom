// Info: Configuration defaults for js-server-helper-verify.
// All fields are optional except STORE. Charsets can be overridden by the
// project, but the defaults are picked for human typing and URL safety.
'use strict';


module.exports = {

  // Numeric charset for short PINs / OTPs (10 chars)
  // Smallest entropy per char, easiest to type on a phone keypad.
  PIN_CHARSET: '0123456789',

  // Alphanumeric uppercase charset for medium-length codes (32 chars).
  // Crockford Base32: digits + uppercase letters minus I, L, O, U.
  // Avoids common typo confusions when read off a screen or printed.
  CODE_CHARSET: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',

  // URL-safe alphanumeric charset for magic-link tokens (62 chars).
  // Highest entropy per char, safe to drop into query strings without escaping.
  TOKEN_CHARSET: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',

  // Store factory function. Pass the result of require() for the chosen
  // adapter package - the same way you pass Lib.Postgres / Lib.MongoDB.
  //   STORE: require('@superloomdev/js-server-helper-verify-store-sqlite')
  //   STORE: require('@superloomdev/js-server-helper-verify-store-postgres')
  //   STORE: require('@superloomdev/js-server-helper-verify-store-mysql')
  //   STORE: require('@superloomdev/js-server-helper-verify-store-mongodb')
  //   STORE: require('@superloomdev/js-server-helper-verify-store-dynamodb')
  // Required. Validated at loader time.
  STORE: null,

  // Per-store configuration. Shape varies by STORE - the chosen store's
  // factory validates its own required keys.
  //   sqlite/postgres/mysql: { table_name: 'verification_codes', lib_sql: Lib.<Driver> }
  //   mongodb:               { collection_name: 'verification_codes', lib_mongodb: Lib.MongoDB }
  //   dynamodb:              { table_name: 'verification_codes', lib_dynamodb: Lib.DynamoDB }
  // Required.
  STORE_CONFIG: null

};
