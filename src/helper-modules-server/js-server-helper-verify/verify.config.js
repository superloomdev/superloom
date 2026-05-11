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

  // Storage adapter. Required - validated at loader time.
  // Must be an object with four required async methods:
  //   getRecord(instance, scope, key)              -> { success, record, error }
  //   setRecord(instance, scope, key, record)      -> { success, error }
  //   incrementFailCount(instance, scope, key)     -> { success, error }
  //   deleteRecord(instance, scope, key)           -> { success, error }
  //
  // One optional async method (for backends without native TTL):
  //   cleanupExpiredRecords(instance)              -> { success, deleted_count, error }
  STORE: null

};
