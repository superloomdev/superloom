// Info: Verify storage adapter for DynamoDB.
// Uses the framework's js-server-helper-nosql-aws-dynamodb helper - the helper's
// `getRecord`, `writeRecord`, `updateRecord`, and `deleteRecord` cover everything
// the verify adapter contract needs.
//
// Schema:
//
//   Table:           verification_codes
//   Partition Key:   scope        (String)   -> verify module's `scope`
//   Sort Key:        id           (String)   -> verify module's `key`
//   Attributes:
//     code        (String)                    -> the generated value
//     fail_count  (Number)                    -> atomic ADD on wrong value
//     created_at  (Number)                    -> Unix epoch seconds
//     expires_at  (Number)                    -> Unix epoch seconds (drives TTL)
//
//   TTL:             enabled on attribute `expires_at` (AWS sweeps within 48 hours)
//   Capacity:        On-demand recommended; this table is intentionally bursty
//   Backups:         disabled - the table is intentionally ephemeral
//
// Notes:
//   - `fail_count` increment uses DynamoDB's atomic ADD via Lib.DynamoDB.updateRecord's
//     `increment` parameter, so concurrent verify attempts on the same record
//     don't race.
//   - `expires_at` is stored as Number (epoch seconds), not String. DynamoDB TTL
//     only fires on Number attributes containing epoch seconds.
'use strict';



/********************************************************************
Build a Verify-compatible storage adapter that talks to DynamoDB.

@param {Object} DynamoDB - Loaded js-server-helper-nosql-aws-dynamodb instance
@param {Object} options - Adapter config
@param {String} options.table - DynamoDB table name (e.g. 'verification_codes')

@return {Object} - Store object with getRecord / setRecord / incrementFailCount / deleteRecord
*********************************************************************/
module.exports = function buildDynamoDbAdapter (DynamoDB, options) {

  const table = options.table;


  return {

    getRecord: async function (instance, scope, key) {

      const result = await DynamoDB.getRecord(instance, table, { scope: scope, id: key });

      if (result.success === false) {
        return {
          success: false,
          record: null,
          error: result.error
        };
      }

      // Absent item -> null record (verify module turns this into NOT_FOUND on consume)
      if (!result.item) {
        return { success: true, record: null, error: null };
      }

      // Strip the keys; verify only reads the four record fields
      return {
        success: true,
        record: {
          code: result.item.code,
          fail_count: result.item.fail_count,
          created_at: result.item.created_at,
          expires_at: result.item.expires_at
        },
        error: null
      };

    },


    setRecord: async function (instance, scope, key, record) {

      // writeRecord overwrites by default - exactly what setRecord wants
      const item = {
        scope: scope,
        id: key,
        code: record.code,
        fail_count: record.fail_count,
        created_at: record.created_at,
        expires_at: record.expires_at
      };

      const result = await DynamoDB.writeRecord(instance, table, item);

      return {
        success: result.success,
        error: result.error || null
      };

    },


    incrementFailCount: async function (instance, scope, key) {

      // updateRecord(instance, table, key, update_data, remove_keys, increment)
      //   `increment: { fail_count: 1 }` translates to ADD fail_count :one - atomic
      const result = await DynamoDB.updateRecord(
        instance,
        table,
        { scope: scope, id: key },
        null,
        null,
        { fail_count: 1 }
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    deleteRecord: async function (instance, scope, key) {

      const result = await DynamoDB.deleteRecord(instance, table, { scope: scope, id: key });

      return {
        success: result.success,
        error: result.error || null
      };

    }

  };

};
