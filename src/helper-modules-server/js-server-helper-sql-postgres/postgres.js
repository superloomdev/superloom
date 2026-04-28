// Info: PostgreSQL client with connection pooling.
//
// Compatibility: Postgres 15+ / AWS Aurora Postgres / 'pg' driver 8.x
//
// Factory pattern: each loader call returns an independent instance with
// its own pool and config. Useful for multi-db or reader/writer splits.
// Driver and pool are both lazy-loaded on first query.
//
// Placeholder parity with js-server-helper-mysql:
//   ?  - value (translated to $1, $2, ... at query time)
//   ?? - identifier (inlined as a double-quoted identifier)
// This keeps application code identical across MySQL and Postgres backends.
'use strict';


// 'pg' is cached once and shared across all instances, since it is
// stateless - only the pool holds state.
let PG = null;



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
state and config.

@param {Object} shared_libs - Lib container with Utils and Debug
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./postgres.config'),
    config || {}
  );

  // Mutable per-instance state (pool lives here)
  const state = {
    pool: null
  };

  // Create and return the public interface
  return createInterface(Lib, CONFIG, state);

};/////////////////////////// Module-Loader END /////////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and state.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} state - Mutable state holder (e.g. pool reference)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const Postgres = { // Public functions accessible by other modules

    // ~~~~~~~~~~~~~~~~~~~~ Read Helpers ~~~~~~~~~~~~~~~~~~~~
    // Typed wrappers over query() for common SELECT shapes.

    /********************************************************************
    Run a SELECT and return the result in the most appropriate shape:
      0 rows             -> null
      1 row, 1 column    -> scalar value
      1 row, N columns   -> row object
      N rows             -> row array (has_multiple_rows = true)

    This is the ambiguous auto-shaping variant - use when the result shape
    is not known upfront. Prefer getRow / getRows / getValue when the shape
    is known.

    @param {Object} instance - Request instance
    @param {String} sql - SQL (typically pre-built with buildQuery)
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, result, has_multiple_rows, error }
    *********************************************************************/
    get: async function (instance, sql, params) {

      // Run the query via the workhorse
      const res = await _Postgres.query(instance, sql, params);

      if (!res.success) {
        return {
          success: false,
          result: null,
          has_multiple_rows: false,
          error: res.error
        };
      }

      const rows = res.rows;

      // 0 rows -> result is null
      if (rows.length === 0) {
        return {
          success: true,
          result: null,
          has_multiple_rows: false,
          error: null
        };
      }

      // Many rows -> result is the rows array, flag the caller
      if (rows.length > 1) {
        return {
          success: true,
          result: rows,
          has_multiple_rows: true,
          error: null
        };
      }

      // Single row -> scalar if only one column, otherwise the row object
      const keys = Object.keys(rows[0]);
      if (keys.length === 1) {
        return {
          success: true,
          result: rows[0][keys[0]],
          has_multiple_rows: false,
          error: null
        };
      }

      return {
        success: true,
        result: rows[0],
        has_multiple_rows: false,
        error: null
      };

    },


    /********************************************************************
    Run a query and return the first row, or null if there are no results.

    @param {Object} instance - Request instance
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, row, error }
    *********************************************************************/
    getRow: async function (instance, sql, params) {

      // Run the query via the workhorse
      const result = await _Postgres.query(instance, sql, params);

      if (!result.success) {
        return {
          success: false,
          row: null,
          error: result.error
        };
      }

      return {
        success: true,
        row: result.rows[0] || null,
        error: null
      };

    },


    /********************************************************************
    Run a query and return every row.

    @param {Object} instance - Request instance
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, rows, count, error }
    *********************************************************************/
    getRows: async function (instance, sql, params) {

      // Run the query via the workhorse
      const result = await _Postgres.query(instance, sql, params);

      if (!result.success) {
        return {
          success: false,
          rows: [],
          count: 0,
          error: result.error
        };
      }

      return {
        success: true,
        rows: result.rows,
        count: result.rows.length,
        error: null
      };

    },


    /********************************************************************
    Run a query and return the first column of the first row. Handy for
    COUNT(*), MAX(), and other single-value lookups.

    @param {Object} instance - Request instance
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, value, error }
    *********************************************************************/
    getValue: async function (instance, sql, params) {

      // Delegate to getRow since we only need one row
      const result = await Postgres.getRow(instance, sql, params);

      if (!result.success) {
        return {
          success: false,
          value: null,
          error: result.error
        };
      }

      if (result.row === null) {
        return {
          success: true,
          value: null,
          error: null
        };
      }

      // Pick the first column of the row
      const keys = Object.keys(result.row);

      return {
        success: true,
        value: keys.length > 0 ? result.row[keys[0]] : null,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write Helper ~~~~~~~~~~~~~~~~~~~~
    // Polymorphic DML runner: single statement or atomic array.

    /********************************************************************
    Run INSERT / UPDATE / DELETE. Polymorphic: string for single statement,
    array for atomic transaction. Array entries may be SQL strings or
    { sql, params } objects.

    Postgres does not have MySQL's LAST_INSERT_ID(); use `RETURNING id`
    in the SQL to get the new primary key - it will be surfaced as
    `insert_id` in the result.

    Single statement:
      await Postgres.write(instance, 'UPDATE users SET name = ? WHERE id = ?', ['John', 1]);

    Atomic transaction:
      await Postgres.write(instance, [
        { sql: 'INSERT INTO logs (msg) VALUES (?)', params: ['User updated'] },
        { sql: 'UPDATE users SET updated_at = NOW() WHERE id = ?', params: [1] }
      ]);

    Returns aggregated affected_rows (summed across statements) and the
    last insert_id seen (useful for multi-insert scenarios).

    affected_rows = total count of rows modified by INSERT / UPDATE / DELETE.
    For array input, this is summed across all statements (e.g., 2 INSERTs
    that each add 1 row = affected_rows: 2).

    insert_id = the primary key from the last INSERT ... RETURNING id. For
    array input, this is the last id seen in the batch (useful when you
    INSERT multiple rows and need the ID of the final one). Postgres has
    no LAST_INSERT_ID() equivalent, so the SQL must include RETURNING id.

    @param {Object} instance - Request instance
    @param {(String|Array)} sql - Single SQL string or array of statements
    @param {Array} [params] - Placeholder values (only when sql is a String)

    @return {Promise<Object>} - { success, affected_rows, insert_id, error }
    *********************************************************************/
    write: async function (instance, sql, params) {

      // No-op on null/undefined or empty array
      if (
        Lib.Utils.isNullOrUndefined(sql) ||
        (Array.isArray(sql) && sql.length === 0)
      ) {
        return {
          success: true,
          affected_rows: 0,
          insert_id: null,
          error: null
        };
      }

      // Single statement - plain execute via private helper
      if (!Array.isArray(sql)) {
        return _Postgres.execute(instance, sql, params);
      }

      // Array - run in a transaction. Normalize to { sql, params } first.
      const statements = sql.map(function (entry) {
        if (Lib.Utils.isString(entry)) {
          return { sql: entry, params: [] };
        }
        return { sql: entry.sql, params: entry.params || [] };
      });

      const res = await _Postgres.transaction(instance, statements);

      if (!res.success) {
        return {
          success: false,
          affected_rows: 0,
          insert_id: null,
          error: res.error
        };
      }

      // Sum affected_rows across statements (total rows modified)
      // Keep the last insert_id seen (useful for multi-insert batch)
      let affected_rows = 0;
      let insert_id = null;

      res.results.forEach(function (r) {
        if (r && typeof r === 'object') {
          affected_rows += r.rowCount || 0;
          const id = _Postgres.extractInsertId(r);
          if (id !== null) {
            insert_id = id;
          }
        }
      });

      return {
        success: true,
        affected_rows: affected_rows,
        insert_id: insert_id,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ SQL String Builders ~~~~~~~~~~~~~~~~~~~~
    // Pure utilities. Build escaped SQL strings without executing them.
    // Pair these to compose complex statements or to build per-entry SQL
    // for a transaction batch.

    /********************************************************************
    Build a parameterised SQL statement into a fully-escaped string.
    Supports ? (value) and ?? (identifier) placeholders, plus the MySQL-
    style `SET ?` / `WHERE ?` object expansion.

    Examples:
      buildQuery('SELECT * FROM ?? WHERE ?? = ?', ['users', 'id', 42])
      buildQuery('INSERT INTO test SET ?',        { name: 'Alice' })
      buildQuery('UPDATE t SET ? WHERE ?',        [{ a: 1 }, { id: 5 }])

    @param {String} sql - SQL template
    @param {(Array|Object|*)} params - Values for ?/?? substitution

    @return {String} - Fully-escaped Postgres SQL
    *********************************************************************/
    buildQuery: function (sql, params) {

      return _Postgres.formatQuery(sql, params);

    },


    /********************************************************************
    Wrap a raw SQL fragment so buildQuery() emits it unescaped.
    Mirrors mysql2.raw - useful for spatial SQL and nested functions.

    Example:
      const point = Postgres.buildRawText(
        "ST_GeomFromText('POINT(28.61 77.20)', 4326)"
      );
      Postgres.buildQuery('INSERT INTO address SET ?', { point: point });

    @param {String} str - Raw SQL fragment

    @return {Object} - Raw-text marker recognized by buildQuery
    *********************************************************************/
    buildRawText: function (str) {

      return { __pg_raw__: true, value: String(str) };

    },


    /********************************************************************
    Join equality conditions with AND or OR. Identifiers and values are
    escaped automatically.

    @param {Object} data - Key-value pairs to join
    @param {String} [multi_operator] - 'AND' (default) or 'OR'

    @return {String} - Escaped condition fragment
    *********************************************************************/
    buildMultiCondition: function (data, multi_operator) {

      const operator = multi_operator || 'AND';

      // One `"k" = v` fragment per key
      const list = [];
      Object.keys(data).forEach(function (key) {
        list.push(
          ' ' + _Postgres.escapeIdentifier(key) + ' = ' + _Postgres.escapeValue(data[key]) + ' '
        );
      });

      return list.join(' ' + operator + ' ');

    },


    // ~~~~~~~~~~~~~~~~~~~~ Pool Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Graceful teardown of the connection pool. Call on SIGTERM / shutdown.

    /********************************************************************
    Close the pool gracefully. Waits up to CONFIG.CLOSE_TIMEOUT_MS for
    active queries to finish, then force-destroys any remaining connections.

    Persistent servers should call this from their shutdown handler;
    serverless functions can skip it since the runtime freezes idle pools.

    @return {Promise<void>}
    *********************************************************************/
    close: async function () {

      // Nothing to close
      if (Lib.Utils.isNullOrUndefined(state.pool)) {
        return;
      }

      Lib.Debug.debug('Postgres: Closing pool', { timeout: CONFIG.CLOSE_TIMEOUT_MS });

      // Try a graceful close first
      const graceful = state.pool.end().then(function () {
        return 'graceful';
      });

      // Fallback: race the graceful close against the configured timeout
      const timeoutPromise = new Promise(function (resolve) {
        setTimeout(function () {
          resolve('timeout');
        }, CONFIG.CLOSE_TIMEOUT_MS);
      });

      const result = await Promise.race([graceful, timeoutPromise]);

      // Fall back to force-destroy if graceful close ran past the timeout
      if (result === 'timeout') {
        Lib.Debug.warning('Postgres: Pool close timed out, force destroying');
        _Postgres.destroyPool();
      }
      else {
        Lib.Debug.debug('Postgres: Pool closed gracefully');
      }

      state.pool = null;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Manual Transactions (Escape Hatch) ~~~~~~~~~~~~~~~~~~~~
    // Low-level connection checkout for transactions that need to interleave
    // business logic between SQL statements (e.g. read balance -> validate ->
    // deduct -> log). In a well-designed schema most writes fit the atomic
    // write() helper, so this is an escape hatch rather than a primary API.
    //
    // Usage:
    //   const { success, client } = await Postgres.getClient(instance);
    //   try {
    //     await client.query('BEGIN');
    //     await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [100, 1]);
    //     await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [100, 2]);
    //     await client.query('COMMIT');
    //   } catch (e) {
    //     await client.query('ROLLBACK');
    //   } finally {
    //     Postgres.releaseClient(client);   // ALWAYS release or the pool leaks
    //   }

    /********************************************************************
    Check out a dedicated pool connection for manual transaction control.
    Must be paired with releaseClient() or the pool will leak.

    @param {Object} instance - Request instance with performance timeline

    @return {Promise<Object>} - { success, client, error }
    *********************************************************************/
    getClient: async function (instance) {

      // Build pool on first call
      _Postgres.initIfNot();

      Lib.Debug.performanceAuditLog('Start', 'Postgres getClient', instance['time_ms']);

      try {

        // Pull a connection out of the pool. Caller must release() it later.
        const client = await state.pool.connect();

        Lib.Debug.performanceAuditLog('End', 'Postgres getClient', instance['time_ms']);

        return {
          success: true,
          client: client,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('Postgres getClient failed', { error: error.message });

        return {
          success: false,
          client: null,
          error: {
            type: 'POOL_ERROR',
            message: error.message
          }
        };

      }

    },


    /********************************************************************
    Return a client from getClient() back to the pool. No-op if null.

    @param {Object} client - Connection from getClient()

    @return {void}
    *********************************************************************/
    releaseClient: function (client) {

      if (client && Lib.Utils.isFunction(client.release)) {
        client.release();
      }

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START//////////////////////////////

  const _Postgres = { // Private functions accessible within this instance only

    // ~~~~~~~~~~~~~~~~~~~~ Adapter and Pool Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Lazy-load the adapter and manage the connection pool.

    /********************************************************************
    Lazy-load the pg adapter. Shared across every instance because
    the driver itself is stateless - only the pool holds state.

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      if (Lib.Utils.isNullOrUndefined(PG)) {
        PG = require('pg');
      }

    },


    /********************************************************************
    Create this instance's connection pool on first use. Options are
    built from the merged CONFIG and tuned for Postgres 15 / Aurora.

    @return {void}
    *********************************************************************/
    initIfNot: function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.pool)) {
        return;
      }

      // Adapter must be loaded before pool creation
      _Postgres.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'Postgres Pool', Date.now());

      // Driver options resolved from the merged CONFIG
      const options = {
        host: CONFIG.HOST,
        port: CONFIG.PORT,
        database: CONFIG.DATABASE,
        user: CONFIG.USER,
        password: CONFIG.PASSWORD,
        max: CONFIG.POOL_MAX,
        min: CONFIG.POOL_MIN,
        idleTimeoutMillis: CONFIG.POOL_IDLE_TIMEOUT_MS,
        connectionTimeoutMillis: CONFIG.CONNECT_TIMEOUT_MS,
        statement_timeout: CONFIG.STATEMENT_TIMEOUT_MS,
        application_name: CONFIG.APPLICATION_NAME,
        keepAlive: true,
        keepAliveInitialDelayMillis: CONFIG.KEEP_ALIVE_INITIAL_DELAY_MS
      };

      // SSL for managed databases. Pass `true` for defaults or an object for custom options.
      if (CONFIG.SSL === true) {
        options.ssl = { rejectUnauthorized: true };
      }
      else if (CONFIG.SSL && typeof CONFIG.SSL === 'object') {
        options.ssl = CONFIG.SSL;
      }

      // Pool is lazy - TCP connections open on the first real query
      state.pool = new PG.Pool(options);

      // Swallow idle client errors so the whole process does not die
      state.pool.on('error', function (err) {
        Lib.Debug.debug('Postgres idle client error', { error: err.message });
      });

      Lib.Debug.performanceAuditLog('Init-End', 'Postgres Pool', Date.now());
      Lib.Debug.info('Postgres Pool Initialized', {
        host: CONFIG.HOST,
        database: CONFIG.DATABASE,
        pool_max: CONFIG.POOL_MAX
      });

    },


    /********************************************************************
    Destroy every connection in the pool. Internal helper used by close()
    when graceful shutdown times out. Public code should call close().

    @return {void}
    *********************************************************************/
    destroyPool: function () {

      if (Lib.Utils.isNullOrUndefined(state.pool)) {
        return;
      }

      try {
        // Reach into the pool internals and destroy every connection
        if (Array.isArray(state.pool._allConnections)) {
          state.pool._allConnections.forEach(function (conn) {
            if (conn && typeof conn.destroy === 'function') {
              conn.destroy();
            }
          });
        }
        if (Array.isArray(state.pool._freeConnections)) {
          state.pool._freeConnections.forEach(function (conn) {
            if (conn && typeof conn.destroy === 'function') {
              conn.destroy();
            }
          });
        }
      }
      catch {
        // Ignore errors during force destroy
      }

    },


    // ~~~~~~~~~~~~~~~~~~~~ SQL Formatting Internals ~~~~~~~~~~~~~~~~~~~~
    // Escape primitives and formatters used by buildQuery and
    // translatePlaceholders. Ordered bottom-up: leaves first, then the
    // formatters that compose them.

    /********************************************************************
    Escape an identifier (table / column name) with double quotes.
    Any embedded " is doubled per the SQL standard.

    @param {String} id - Identifier

    @return {String} - Double-quoted, safely escaped
    *********************************************************************/
    escapeIdentifier: function (id) {

      return '"' + String(id).replace(/"/g, '""') + '"';

    },


    /********************************************************************
    Escape a scalar value as a Postgres literal.
    - null / undefined -> NULL
    - boolean          -> TRUE / FALSE
    - number           -> digit string (checked for NaN / Infinity)
    - Date             -> ISO timestamp literal
    - Buffer           -> hex bytea literal
    - string           -> single-quoted, embedded quotes doubled;
                          falls back to E'...' escape if the string
                          contains backslashes

    @param {*} val - Scalar value

    @return {String} - Postgres-safe literal
    *********************************************************************/
    escapeValue: function (val) {

      if (val === null || val === undefined) {
        return 'NULL';
      }

      if (typeof val === 'boolean') {
        return val ? 'TRUE' : 'FALSE';
      }

      if (typeof val === 'number') {
        if (!Number.isFinite(val)) {
          throw new Error('Cannot serialize non-finite number: ' + val);
        }
        return String(val);
      }

      if (typeof val === 'bigint') {
        return val.toString();
      }

      if (val instanceof Date) {
        return '\'' + val.toISOString() + '\'';
      }

      if (Buffer.isBuffer(val)) {
        return '\'\\x' + val.toString('hex') + '\'';
      }

      // String (and anything else) - escape single quotes + backslashes
      const str = String(val);
      const escaped = str.replace(/'/g, '\'\'');

      // Use E-strings if the value contains backslashes (standard_conforming_strings safety)
      if (escaped.indexOf('\\') !== -1) {
        return 'E\'' + escaped.replace(/\\/g, '\\\\') + '\'';
      }

      return '\'' + escaped + '\'';

    },


    /********************************************************************
    Format a single value for inclusion in a fully-escaped SQL string.
    Handles scalars, arrays, objects (k=v pairs), and raw fragments.
    Composes escapeIdentifier and escapeValue.

    @param {*} val - Value to format

    @return {String} - Formatted literal
    *********************************************************************/
    formatValue: function (val) {

      // Raw fragment - emit as-is
      if (val && typeof val === 'object' && val.__pg_raw__ === true) {
        return val.value;
      }

      // Array - comma-joined escaped literals (IN clause pattern)
      if (Array.isArray(val)) {
        return val.map(_Postgres.formatValue).join(', ');
      }

      // Plain object - "k1" = v1, "k2" = v2 (SET / WHERE expansion)
      if (val && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
        const pairs = [];
        Object.keys(val).forEach(function (key) {
          pairs.push(_Postgres.escapeIdentifier(key) + ' = ' + _Postgres.formatValue(val[key]));
        });
        return pairs.join(', ');
      }

      return _Postgres.escapeValue(val);

    },


    /********************************************************************
    Format a SQL template into a fully-escaped string.
    Mirrors mysql2.format semantics on top of Postgres escape rules:
      - ?  scalar  -> escaped literal
      - ?  array   -> comma-joined escaped literals (for IN clauses)
      - ?  object  -> `"k1" = v1, "k2" = v2` (for SET/WHERE)
      - ?? scalar  -> double-quoted identifier
      - ?? array   -> comma-joined identifiers

    Walks inside single-quoted strings / double-quoted identifiers /
    line comments to avoid replacing placeholders there.

    @param {String} sql - Source SQL
    @param {*} params - Scalar, array, or object

    @return {String} - Fully-escaped Postgres SQL
    *********************************************************************/
    formatQuery: function (sql, params) {

      if (Lib.Utils.isNullOrUndefined(params)) {
        return sql;
      }

      // Normalize to an array for sequential consumption
      const values = Array.isArray(params) ? params.slice() : [params];

      let out = '';
      let value_idx = 0;
      let i = 0;

      while (i < sql.length) {

        const ch = sql[i];

        // Single-quoted string - emit verbatim
        if (ch === '\'') {
          out += ch;
          i++;
          while (i < sql.length) {
            const c = sql[i];
            out += c;
            i++;
            if (c === '\'') {
              if (sql[i] === '\'') {
                out += '\'';
                i++;
                continue;
              }
              break;
            }
          }
          continue;
        }

        // Double-quoted identifier - emit verbatim
        if (ch === '"') {
          out += ch;
          i++;
          while (i < sql.length) {
            const c = sql[i];
            out += c;
            i++;
            if (c === '"') {
              break;
            }
          }
          continue;
        }

        // Line comment
        if (ch === '-' && sql[i + 1] === '-') {
          while (i < sql.length && sql[i] !== '\n') {
            out += sql[i];
            i++;
          }
          continue;
        }

        // ?? - identifier(s)
        if (ch === '?' && sql[i + 1] === '?') {
          const val = values[value_idx++];
          if (Array.isArray(val)) {
            out += val.map(_Postgres.escapeIdentifier).join(', ');
          }
          else {
            out += _Postgres.escapeIdentifier(String(val));
          }
          i += 2;
          continue;
        }

        // ? - value / array / object
        if (ch === '?') {
          const val = values[value_idx++];
          out += _Postgres.formatValue(val);
          i++;
          continue;
        }

        out += ch;
        i++;

      }

      return out;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Placeholder / Result Translation ~~~~~~~~~~~~~~~~~~~~
    // Convert MySQL-style placeholders into native Postgres form at query
    // time, and pull primary-key values out of RETURNING clauses.

    /********************************************************************
    Translate MySQL-style placeholders (? values, ?? identifiers) into
    Postgres native placeholders ($1, $2, ...) with identifiers inlined.

    Walks the SQL character-by-character so placeholders inside string
    literals, double-quoted identifiers, and -- line comments are ignored.

    @param {String} sql - Source SQL with ?/?? placeholders
    @param {Array} params - Values to bind (consumed in order)

    @return {Object} - { sql, params } ready for pool.query
    *********************************************************************/
    translatePlaceholders: function (sql, params) {

      // Fast path: no params, nothing to translate
      if (!params || params.length === 0) {
        return { sql: sql, params: [] };
      }

      let out = '';
      let param_idx = 0;
      const out_params = [];
      let pg_idx = 1;
      let i = 0;

      while (i < sql.length) {

        const ch = sql[i];

        // Skip single-quoted string literals (respect doubled '' escape)
        if (ch === '\'') {
          out += ch;
          i++;
          while (i < sql.length) {
            const c = sql[i];
            out += c;
            i++;
            if (c === '\'') {
              if (sql[i] === '\'') {
                out += '\'';
                i++;
                continue;
              }
              break;
            }
          }
          continue;
        }

        // Skip double-quoted identifiers
        if (ch === '"') {
          out += ch;
          i++;
          while (i < sql.length) {
            const c = sql[i];
            out += c;
            i++;
            if (c === '"') {
              break;
            }
          }
          continue;
        }

        // Skip -- line comments
        if (ch === '-' && sql[i + 1] === '-') {
          while (i < sql.length && sql[i] !== '\n') {
            out += sql[i];
            i++;
          }
          continue;
        }

        // ?? - identifier (inline, escaped)
        if (ch === '?' && sql[i + 1] === '?') {
          const val = params[param_idx++];
          out += _Postgres.escapeIdentifier(String(val));
          i += 2;
          continue;
        }

        // ? - value ($N)
        if (ch === '?') {
          out_params.push(params[param_idx++]);
          out += '$' + pg_idx;
          pg_idx++;
          i++;
          continue;
        }

        out += ch;
        i++;

      }

      return { sql: out, params: out_params };

    },


    /********************************************************************
    Extract the primary-key insert id from a pg result if the caller
    used `INSERT ... RETURNING id` (or RETURNING *).

    @param {Object} result - Raw pg result

    @return {*} - id value, or null if not present
    *********************************************************************/
    extractInsertId: function (result) {

      if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (row && Object.prototype.hasOwnProperty.call(row, 'id')) {
        return row.id;
      }

      return null;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Core SQL Execution ~~~~~~~~~~~~~~~~~~~~
    // The workhorses - all I/O routes through here in dependency order:
    // query -> execute|transaction

    /********************************************************************
    Run any SQL. The core workhorse - all other I/O functions route through here.
    Placeholders: ? for values, ?? for identifiers (translated to $N at runtime).

    @param {Object} instance - Request instance (for time_ms tracing)
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, rows, fields, affected_rows, insert_id, error }
    *********************************************************************/
    query: async function (instance, sql, params) {

      // Build pool on first call
      _Postgres.initIfNot();

      // Start performance timeline
      Lib.Debug.performanceAuditLog('Start', 'Postgres Query', instance['time_ms']);

      try {

        // Translate MySQL-style ? / ?? placeholders to Postgres $N and inline identifiers
        const compiled = _Postgres.translatePlaceholders(sql, params || []);

        // Execute - pool.query auto-checks-out and releases a connection
        const result = await state.pool.query(compiled.sql, compiled.params);

        Lib.Debug.performanceAuditLog('End', 'Postgres Query', instance['time_ms']);

        // pg returns rowCount always; rows is empty for DML unless RETURNING clause is used
        // affected_rows = rows modified (0 for SELECT)
        // insert_id = primary key from `INSERT ... RETURNING id` (null for SELECT or INSERT without RETURNING)
        return {
          success: true,
          rows: result.rows || [],
          fields: result.fields || [],
          affected_rows: result.rowCount || 0,
          insert_id: _Postgres.extractInsertId(result),
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('Postgres query failed', { error: error.message, code: error.code || null });

        return {
          success: false,
          rows: [],
          fields: [],
          affected_rows: 0,
          insert_id: null,
          error: {
            type: 'QUERY_ERROR',
            message: error.message,
            code: error.code || null
          }
        };

      }

    },


    /********************************************************************
    Run an INSERT / UPDATE / DELETE statement. Internal helper used by write().
    Depends on query() for execution.

    Postgres does not have MySQL's LAST_INSERT_ID(); use `RETURNING id`
    in the SQL to get the new primary key - it will be surfaced as
    `insert_id` in the result.

    @param {Object} instance - Request instance
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, affected_rows, insert_id, error }
    *********************************************************************/
    execute: async function (instance, sql, params) {

      // Run the statement via the workhorse
      const result = await _Postgres.query(instance, sql, params);

      if (!result.success) {
        return {
          success: false,
          affected_rows: 0,
          insert_id: null,
          error: result.error
        };
      }

      // Return DML-specific fields:
      // affected_rows = how many rows were inserted/updated/deleted
      // insert_id = primary key of the new row if RETURNING id was used (null otherwise)
      return {
        success: true,
        affected_rows: result.affected_rows,
        insert_id: result.insert_id,
        error: null
      };

    },


    /********************************************************************
    Run many statements atomically. All commit, or all roll back.
    Internal helper used by write() for array input. Depends on initIfNot()
    for pool access and manages its own connection lifecycle.

    @param {Object} instance - Request instance
    @param {Array} statements - Array of { sql, params } objects

    @return {Promise<Object>} - { success, results, error }
    *********************************************************************/
    transaction: async function (instance, statements) {

      // Build pool on first call
      _Postgres.initIfNot();

      // Holds the checked-out connection so both success and error paths can release it
      let client = null;

      Lib.Debug.performanceAuditLog('Start', 'Postgres Transaction', instance['time_ms']);

      try {

        // Check out a dedicated connection and open a transaction on it
        client = await state.pool.connect();
        await client.query('BEGIN');

        // Run each statement sequentially on the same connection
        const results = [];
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          const compiled = _Postgres.translatePlaceholders(stmt.sql, stmt.params || []);
          const res = await client.query(compiled.sql, compiled.params);
          results.push(res);
        }

        // Commit and return the connection to the pool
        await client.query('COMMIT');
        client.release();

        Lib.Debug.performanceAuditLog('End', 'Postgres Transaction', instance['time_ms']);

        return {
          success: true,
          results: results,
          error: null
        };

      }
      catch (error) {

        // Roll back and release. Guard against rollback itself throwing.
        if (client) {
          try { await client.query('ROLLBACK'); } catch { /* already failing - ignore */ }
          client.release();
        }

        Lib.Debug.debug('Postgres transaction failed', { error: error.message, code: error.code || null });

        return {
          success: false,
          results: [],
          error: {
            type: 'TRANSACTION_ERROR',
            message: error.message,
            code: error.code || null
          }
        };

      }

    }

  };//////////////////////////Private Functions END//////////////////////////////



  // Return the public interface
  return Postgres;

};/////////////////////////// createInterface END //////////////////////////////
