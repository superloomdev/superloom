// Info: MySQL client with connection pooling.
//
// Compatibility: MySQL 8.0.44+ / mysql2 driver 3.x
//
// Factory pattern: each loader call returns an independent instance with
// its own pool and config. Useful for multi-db or reader/writer splits.
// Driver and pool are both lazy-loaded on first query.
'use strict';


// mysql2 ships two entry points. Both are cached once and shared across
// all instances, since they are stateless (only the pool holds state).
//   - 'mysql2'         -> format() and raw(), used by buildQuery/buildRawText
//   - 'mysql2/promise' -> createPool() with async/await, used by initIfNot
// The promise build does not re-export format()/raw(), so we need both.
let MySQLDriver = null;
let MySQLDriverPromise = null;


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
    require('./mysql.config'),
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
  const MySQL = { // Public functions accessible by other modules

    // ~~~~~~~~~~~~~~~~~~~~ Read Helpers ~~~~~~~~~~~~~~~~~~~~
    // Typed wrappers over query() for common SELECT shapes.

    /********************************************************************
    Run a SELECT and return the result in the most appropriate shape:
      0 rows             -> null
      1 row, 1 column  -> scalar value
      1 row, N columns -> row object
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
      const res = await _MySQL.query(instance, sql, params);

      // Bubble up the error, keeping the function's own shape
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
      const result = await _MySQL.query(instance, sql, params);

      // Bubble up the error, keeping the function's own shape
      if (!result.success) {
        return {
          success: false,
          row: null,
          error: result.error
        };
      }

      // Pick the first row, or null if the result set is empty
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
      const result = await _MySQL.query(instance, sql, params);

      // Bubble up the error, keeping the function's own shape
      if (!result.success) {
        return {
          success: false,
          rows: [],
          count: 0,
          error: result.error
        };
      }

      // Return every row plus a convenience count
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
      const result = await MySQL.getRow(instance, sql, params);

      // Bubble up the error, keeping the function's own shape
      if (!result.success) {
        return {
          success: false,
          value: null,
          error: result.error
        };
      }

      // No row -> null value (not an error)
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

    Single statement:
      await MySQL.write(instance, 'UPDATE users SET name = ? WHERE id = ?', ['John', 1]);

    Atomic transaction:
      await MySQL.write(instance, [
        { sql: 'INSERT INTO logs (msg) VALUES (?)', params: ['User updated'] },
        { sql: 'UPDATE users SET updated_at = NOW() WHERE id = ?', params: [1] }
      ]);

    Returns aggregated affected_rows (summed across statements) and the
    last insert_id seen (useful for multi-insert scenarios).

    affected_rows = total count of rows modified by INSERT / UPDATE / DELETE.
    For array input, this is summed across all statements (e.g., 2 INSERTs
    that each add 1 row = affected_rows: 2).

    insert_id = the auto-increment primary key from the last INSERT. For
    array input, this is the last insertId seen in the batch (useful when
    you INSERT multiple rows and need the ID of the final one).

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
        return _MySQL.execute(instance, sql, params);
      }

      // Array - run in a transaction. Normalize to { sql, params } first.
      const statements = sql.map(function (entry) {
        if (Lib.Utils.isString(entry)) {
          return { sql: entry, params: [] };
        }
        return { sql: entry.sql, params: entry.params || [] };
      });

      const res = await _MySQL.transaction(instance, statements);

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
        if (r && typeof r === 'object' && !Array.isArray(r)) {
          affected_rows += r.affectedRows || 0;
          if (r.insertId) {
            insert_id = r.insertId;
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
    Compile a parameterised SQL template into a fully-escaped string.
    Uses ? for values and ?? for identifiers. Pair with buildRawText()
    for fragments that must not be escaped.

    Examples:
      buildQuery('SELECT * FROM ?? WHERE ?? = ?', ['users', 'id', 42])
      buildQuery('INSERT INTO test SET ?',        { name: 'Alice' })
      buildQuery('UPDATE t SET ? WHERE ?',        [{ a: 1 }, { id: 5 }])

    @param {String} sql - SQL template with ?/?? placeholders
    @param {(Array|Object|*)} params - Values to substitute

    @return {String} - Fully-escaped SQL
    *********************************************************************/
    buildQuery: function (sql, params) {

      _MySQL.ensureAdapter();
      return MySQLDriver.format(sql, params);

    },


    /********************************************************************
    Mark a SQL fragment as raw so buildQuery() leaves it unescaped.
    Use for spatial functions, nested sub-queries, and similar fragments.

    Example:
      const point = Lib.SqlDB.buildRawText(
        "ST_GeomFromText('POINT(28.61 77.20)', 4326)"
      );
      Lib.SqlDB.buildQuery('INSERT INTO address SET ?', {
        city: 'Delhi',
        point: point
      });

    @param {String} str - Raw SQL fragment

    @return {Object} - Raw marker understood by mysql2.format
    *********************************************************************/
    buildRawText: function (str) {

      _MySQL.ensureAdapter();
      return MySQLDriver.raw(str);

    },


    /********************************************************************
    Join equality conditions with AND or OR. Identifiers and values are
    escaped automatically.

    @param {Object} data - Key-value pairs to join
    @param {String} [multi_operator] - 'AND' (default) or 'OR'

    @return {String} - Escaped condition fragment
    *********************************************************************/
    buildMultiCondition: function (data, multi_operator) {

      _MySQL.ensureAdapter();

      const operator = multi_operator || 'AND';

      // One `?? = ?` fragment per key
      const list = [];
      Object.keys(data).forEach(function (key) {
        list.push(MySQLDriver.format(' ?? = ? ', [key, data[key]]));
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

      Lib.Debug.debug('MySQL: Closing pool', { timeout: CONFIG.CLOSE_TIMEOUT_MS });

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
        Lib.Debug.warning('MySQL: Pool close timed out, force destroying');
        _MySQL.destroyPool();
      }
      else {
        Lib.Debug.debug('MySQL: Pool closed gracefully');
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
    //   const { success, client } = await MySQL.getClient(instance);
    //   try {
    //     await client.beginTransaction();
    //     await client.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1]);
    //     await client.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2]);
    //     await client.commit();
    //   } catch (e) {
    //     await client.rollback();
    //   } finally {
    //     MySQL.releaseClient(client);   // ALWAYS release or the pool leaks
    //   }

    /********************************************************************
    Check out a dedicated pool connection for manual transaction control.
    Must be paired with releaseClient() or the pool will leak.

    @param {Object} instance - Request instance with performance timeline

    @return {Promise<Object>} - { success, client, error }
    *********************************************************************/
    getClient: async function (instance) {

      // Build pool on first call
      _MySQL.initIfNot();

      Lib.Debug.performanceAuditLog('Start', 'MySQL getClient', instance['time_ms']);

      try {

        // Pull a connection out of the pool. Caller must release() it later.
        const client = await state.pool.getConnection();

        Lib.Debug.performanceAuditLog('End', 'MySQL getClient', instance['time_ms']);

        return {
          success: true,
          client: client,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('MySQL getClient failed', { error: error.message });

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

  const _MySQL = { // Private functions accessible within this instance only

    // ~~~~~~~~~~~~~~~~~~~~ Adapter and Pool Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Lazy-load the adapter and manage the connection pool.

    /********************************************************************
    Lazy-load the mysql2 adapter. Shared across every instance because
    the driver itself is stateless - only the pool holds state.

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      // Synchronous utilities (format, raw)
      if (Lib.Utils.isNullOrUndefined(MySQLDriver)) {
        MySQLDriver = require('mysql2');
      }

      // Promise-based pool API
      if (Lib.Utils.isNullOrUndefined(MySQLDriverPromise)) {
        MySQLDriverPromise = require('mysql2/promise');
      }

    },


    /********************************************************************
    Create this instance's connection pool on first use. Options are
    built from the merged CONFIG and tuned for MySQL 8+.

    @return {void}
    *********************************************************************/
    initIfNot: function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.pool)) {
        return;
      }

      // Adapter must be loaded before pool creation
      _MySQL.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'MySQL Pool', Date.now());

      // Driver options resolved from the merged CONFIG
      const options = {
        host: CONFIG.HOST,
        port: CONFIG.PORT,
        database: CONFIG.DATABASE,
        user: CONFIG.USER,
        password: CONFIG.PASSWORD,
        waitForConnections: true,
        connectionLimit: CONFIG.POOL_MAX,
        queueLimit: CONFIG.POOL_QUEUE_LIMIT,
        enableKeepAlive: true,
        keepAliveInitialDelay: CONFIG.KEEP_ALIVE_INITIAL_DELAY_MS,
        multipleStatements: CONFIG.MULTIPLE_STATEMENTS,
        charset: CONFIG.CHARSET,
        timezone: CONFIG.TIMEZONE,
        connectTimeout: CONFIG.CONNECT_TIMEOUT_MS,
        idleTimeout: CONFIG.POOL_IDLE_TIMEOUT_MS,
        namedPlaceholders: false
      };

      // SSL for managed databases. Pass `true` for defaults or an object for custom options.
      if (CONFIG.SSL === true) {
        options.ssl = { rejectUnauthorized: true };
      }
      else if (CONFIG.SSL && typeof CONFIG.SSL === 'object') {
        options.ssl = CONFIG.SSL;
      }

      // Pool is lazy - TCP connections open on the first real query
      state.pool = MySQLDriverPromise.createPool(options);

      Lib.Debug.performanceAuditLog('Init-End', 'MySQL Pool', Date.now());
      Lib.Debug.debug('MySQL Pool Initialized', {
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


    // ~~~~~~~~~~~~~~~~~~~~ Core SQL Execution ~~~~~~~~~~~~~~~~~~~~
    // The workhorses - all I/O routes through here in dependency order:
    // query -> execute|transaction

    /********************************************************************
    Run any SQL. The core workhorse - all other I/O functions route through here.
    Placeholders: ? for values, ?? for identifiers.

    @param {Object} instance - Request instance (for time_ms tracing)
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, rows, fields, affected_rows, insert_id, error }
    *********************************************************************/
    query: async function (instance, sql, params) {

      // Build pool on first call
      _MySQL.initIfNot();

      // Start performance timeline
      Lib.Debug.performanceAuditLog('Start', 'MySQL Query', instance['time_ms']);

      try {

        // Run the query. The pool checks out and releases a connection automatically.
        const [result, fields] = await state.pool.query(sql, params || []);

        Lib.Debug.performanceAuditLog('End', 'MySQL Query', instance['time_ms']);

        // SELECT returns an array of rows; DML returns a ResultSetHeader object
        const is_header = !Array.isArray(result);

        // Shape a uniform response regardless of query type
        // affected_rows = rows modified (0 for SELECT)
        // insert_id = auto-increment ID from last INSERT (null for SELECT)
        return {
          success: true,
          rows: is_header ? [] : result,
          fields: fields || [],
          affected_rows: is_header ? (result.affectedRows || 0) : 0,
          insert_id: is_header ? (result.insertId || null) : null,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('MySQL query failed', { error: error.message, code: error.code || null });

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

    @param {Object} instance - Request instance
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, affected_rows, insert_id, error }
    *********************************************************************/
    execute: async function (instance, sql, params) {

      // Run the statement via the workhorse
      const result = await _MySQL.query(instance, sql, params);

      // Bubble up the error, keeping the function's own shape
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
      // insert_id = auto-increment ID of the new row (null for UPDATE/DELETE)
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
    @param {Array} statements - Array of { sql, params }

    @return {Promise<Object>} - { success, results, error }
    *********************************************************************/
    transaction: async function (instance, statements) {

      // Build pool on first call
      _MySQL.initIfNot();

      // Holds the checked-out connection so both success and error paths can release it
      let conn = null;

      Lib.Debug.performanceAuditLog('Start', 'MySQL Transaction', instance['time_ms']);

      try {

        // Check out a dedicated connection and open a transaction on it
        conn = await state.pool.getConnection();
        await conn.beginTransaction();

        // Run each statement sequentially on the same connection
        const results = [];
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          const [rows] = await conn.query(stmt.sql, stmt.params || []);
          results.push(rows);
        }

        // Commit and return the connection to the pool
        await conn.commit();
        conn.release();

        Lib.Debug.performanceAuditLog('End', 'MySQL Transaction', instance['time_ms']);

        return {
          success: true,
          results: results,
          error: null
        };

      }
      catch (error) {

        // Roll back and release. Guard against rollback itself throwing.
        if (conn) {
          try { await conn.rollback(); } catch { /* already failing - ignore */ }
          conn.release();
        }

        Lib.Debug.debug('MySQL transaction failed', { error: error.message, code: error.code || null });

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
  return MySQL;

};/////////////////////////// createInterface END //////////////////////////////
