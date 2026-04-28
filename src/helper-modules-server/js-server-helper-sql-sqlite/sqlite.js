// Info: SQLite client built on the Node.js built-in 'node:sqlite' module.
//
// Compatibility: Node.js 22.13+ (stable) or 24+ / SQLite 3.x (bundled)
//
// Factory pattern: each loader call returns an independent instance with
// its own database handle and config. Useful for multi-db scenarios
// (e.g. one cache DB + one analytics DB).
//
// Placeholder parity with js-server-helper-sql-mysql / js-server-helper-sql-postgres:
//   ?  - value (kept as-is, SQLite natively supports ? placeholders)
//   ?? - identifier (inlined as a double-quoted identifier)
// This keeps application code identical across MySQL, Postgres, and SQLite.
//
// API parity:
//   - Same public functions: get/getRow/getRows/getValue/write/close/
//     getClient/releaseClient/buildQuery/buildRawText/buildMultiCondition
//   - Same return shapes (success/error envelope, affected_rows, insert_id)
//   - SQLite has no pool - state.db holds a single synchronous handle.
//     I/O functions remain async to match the MySQL / Postgres interface.
//   - insert_id comes for free from SQLite's lastInsertRowid (no RETURNING
//     clause required, unlike Postgres).
'use strict';


// 'node:sqlite' is cached once and shared across all instances, since it is
// stateless - only the database handle holds state.
let SQLiteDriver = null;


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
    require('./sqlite.config'),
    config || {}
  );

  // Mutable per-instance state (db handle lives here)
  const state = {
    db: null
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
@param {Object} state - Mutable state holder (db handle)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const SQLite = { // Public functions accessible by other modules

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
      const res = await _SQLite.query(instance, sql, params);

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
      const result = await _SQLite.query(instance, sql, params);

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
      const result = await _SQLite.query(instance, sql, params);

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
      const result = await SQLite.getRow(instance, sql, params);

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

    Unlike Postgres, SQLite provides insert_id automatically via
    sqlite3_last_insert_rowid() - no RETURNING clause is required. For a
    table with INTEGER PRIMARY KEY (or ROWID), insert_id is the primary key.

    Single statement:
      await SQLite.write(instance, 'UPDATE users SET name = ? WHERE id = ?', ['John', 1]);

    Atomic transaction:
      await SQLite.write(instance, [
        { sql: 'INSERT INTO logs (msg) VALUES (?)', params: ['User updated'] },
        { sql: 'UPDATE users SET updated_at = ? WHERE id = ?', params: [new Date(), 1] }
      ]);

    Returns aggregated affected_rows (summed across statements) and the
    last insert_id seen (useful for multi-insert scenarios).

    affected_rows = total count of rows modified by INSERT / UPDATE / DELETE.
    For array input, this is summed across all statements.

    insert_id = the primary key of the last INSERT (sqlite3_last_insert_rowid).
    For array input, this is the last insert_id seen in the batch. Null for
    UPDATE / DELETE / DDL statements.

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
        return _SQLite.execute(instance, sql, params);
      }

      // Array - run in a transaction. Normalize to { sql, params } first.
      const statements = sql.map(function (entry) {
        if (Lib.Utils.isString(entry)) {
          return { sql: entry, params: [] };
        }
        return { sql: entry.sql, params: entry.params || [] };
      });

      const res = await _SQLite.transaction(instance, statements);

      if (!res.success) {
        return {
          success: false,
          affected_rows: 0,
          insert_id: null,
          error: res.error
        };
      }

      // Sum affected_rows across statements; keep last insert_id seen
      let affected_rows = 0;
      let insert_id = null;

      res.results.forEach(function (r) {
        if (r && typeof r === 'object') {
          affected_rows += r.affected_rows || 0;
          if (r.insert_id !== null && r.insert_id !== undefined) {
            insert_id = r.insert_id;
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

    @return {String} - Fully-escaped SQLite SQL
    *********************************************************************/
    buildQuery: function (sql, params) {

      return _SQLite.formatQuery(sql, params);

    },


    /********************************************************************
    Wrap a raw SQL fragment so buildQuery() emits it unescaped.
    Mirrors mysql2.raw / the Postgres equivalent - useful for nested
    function calls, CURRENT_TIMESTAMP, and similar fragments.

    Example:
      const now = SQLite.buildRawText('CURRENT_TIMESTAMP');
      SQLite.buildQuery('INSERT INTO logs SET ?', { created_at: now });

    @param {String} str - Raw SQL fragment

    @return {Object} - Raw-text marker recognized by buildQuery
    *********************************************************************/
    buildRawText: function (str) {

      return { __sqlite_raw__: true, value: String(str) };

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
          ' ' + _SQLite.escapeIdentifier(key) + ' = ' + _SQLite.formatValue(data[key]) + ' '
        );
      });

      return list.join(' ' + operator + ' ');

    },


    // ~~~~~~~~~~~~~~~~~~~~ Handle Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Graceful teardown of the database handle. Call on SIGTERM / shutdown.

    /********************************************************************
    Close the database handle. SQLite's close() is synchronous, so this
    function resolves immediately. The CLOSE_TIMEOUT_MS config key is
    present for API parity with MySQL / Postgres.

    Persistent servers should call this from their shutdown handler;
    serverless functions can skip it since the runtime freezes idle handles.

    @return {Promise<void>}
    *********************************************************************/
    close: async function () {

      // Nothing to close
      if (Lib.Utils.isNullOrUndefined(state.db)) {
        return;
      }

      Lib.Debug.debug('SQLite: Closing database', { file: CONFIG.FILE });

      try {
        state.db.close();
        Lib.Debug.debug('SQLite: Database closed');
      }
      catch (error) {
        Lib.Debug.debug('SQLite close failed', { file: CONFIG.FILE, error: error.message });
      }

      state.db = null;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Manual Transactions (Escape Hatch) ~~~~~~~~~~~~~~~~~~~~
    // Low-level handle access for transactions that need to interleave
    // business logic between SQL statements (e.g. read balance -> validate ->
    // deduct -> log). In a well-designed schema most writes fit the atomic
    // write() helper, so this is an escape hatch rather than a primary API.
    //
    // SQLite has no connection pool - every loader instance has a single
    // handle, so getClient() always returns the same handle. releaseClient()
    // is a no-op, kept for API parity with MySQL / Postgres.
    //
    // Usage:
    //   const { success, client } = await SQLite.getClient(instance);
    //   try {
    //     client.exec('BEGIN');
    //     client.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(100, 1);
    //     client.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(100, 2);
    //     client.exec('COMMIT');
    //   } catch (e) {
    //     client.exec('ROLLBACK');
    //   } finally {
    //     SQLite.releaseClient(client);   // no-op but keep for API parity
    //   }

    /********************************************************************
    Return the underlying DatabaseSync handle for manual transaction control.
    Must be paired with releaseClient() for API parity with MySQL / Postgres
    (it is a no-op for SQLite but callers should still pair them).

    @param {Object} instance - Request instance with performance timeline

    @return {Promise<Object>} - { success, client, error }
    *********************************************************************/
    getClient: async function (instance) {

      // Build handle on first call
      _SQLite.initIfNot();

      Lib.Debug.performanceAuditLog('Start', 'SQLite getClient', instance['time_ms']);

      try {

        // SQLite has a single handle per instance - return it directly
        Lib.Debug.performanceAuditLog('End', 'SQLite getClient', instance['time_ms']);

        return {
          success: true,
          client: state.db,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('SQLite getClient failed', { error: error.message });

        return {
          success: false,
          client: null,
          error: {
            type: 'HANDLE_ERROR',
            message: error.message
          }
        };

      }

    },


    /********************************************************************
    No-op for SQLite (single handle per instance). Kept for API parity.

    @param {Object} client - Handle from getClient()

    @return {void}
    *********************************************************************/
    releaseClient: function (client) { // eslint-disable-line no-unused-vars

      // Nothing to release - the handle stays alive for the instance's lifetime

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START//////////////////////////////

  const _SQLite = { // Private functions accessible within this instance only

    // ~~~~~~~~~~~~~~~~~~~~ Adapter and Handle Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Lazy-load the adapter and manage the database handle.

    /********************************************************************
    Lazy-load the node:sqlite adapter. Shared across every instance because
    the module itself is stateless - only the database handle holds state.

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      if (Lib.Utils.isNullOrUndefined(SQLiteDriver)) {
        SQLiteDriver = require('node:sqlite');
      }

    },


    /********************************************************************
    Create this instance's database handle on first use. Options are
    built from the merged CONFIG and tuned for SQLite 3.x.

    Applies configured PRAGMAs (journal_mode, synchronous) after open so
    callers get sensible defaults without needing to issue their own PRAGMA
    statements.

    @return {void}
    *********************************************************************/
    initIfNot: function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.db)) {
        return;
      }

      // Adapter must be loaded before handle creation
      _SQLite.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'SQLite Handle', Date.now());

      // Constructor options resolved from the merged CONFIG
      const options = {
        readOnly: CONFIG.READONLY === true,
        enableForeignKeyConstraints: CONFIG.ENABLE_FOREIGN_KEYS !== false,
        timeout: CONFIG.TIMEOUT_MS || 0
      };

      state.db = new SQLiteDriver.DatabaseSync(CONFIG.FILE, options);

      // Apply PRAGMAs. WAL makes no sense for :memory: so skip there.
      const is_memory = CONFIG.FILE === ':memory:' || CONFIG.FILE === '';
      if (!is_memory && !options.readOnly && CONFIG.JOURNAL_MODE) {
        state.db.exec('PRAGMA journal_mode = ' + _SQLite.escapePragmaValue(CONFIG.JOURNAL_MODE));
      }

      if (!options.readOnly && CONFIG.SYNCHRONOUS) {
        state.db.exec('PRAGMA synchronous = ' + _SQLite.escapePragmaValue(CONFIG.SYNCHRONOUS));
      }

      Lib.Debug.performanceAuditLog('Init-End', 'SQLite Handle', Date.now());
      Lib.Debug.info('SQLite Handle Initialized', {
        file: CONFIG.FILE,
        readonly: options.readOnly,
        journal_mode: is_memory ? 'memory' : CONFIG.JOURNAL_MODE
      });

    },


    /********************************************************************
    Whitelist-validate a PRAGMA value so we can safely inline it.
    Rejects anything outside the allowed keyword set.

    @param {String} val - Candidate PRAGMA value

    @return {String} - Same value, uppercased

    @throws {Error} If the value is not whitelisted
    *********************************************************************/
    escapePragmaValue: function (val) {

      const allowed = [
        'DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF',
        'NORMAL', 'FULL', 'EXTRA'
      ];

      const upper = String(val).toUpperCase();

      if (allowed.indexOf(upper) === -1) {
        throw new Error('SQLite: invalid PRAGMA value: ' + val);
      }

      return upper;

    },


    // ~~~~~~~~~~~~~~~~~~~~ SQL Formatting Internals ~~~~~~~~~~~~~~~~~~~~
    // Escape primitives and formatters used by buildQuery and
    // translatePlaceholders. Ordered bottom-up: leaves first, then the
    // formatters that compose them.

    /********************************************************************
    Escape an identifier (table / column name) with double quotes.
    Any embedded " is doubled per the SQL standard. SQLite supports
    double-quoted identifiers natively.

    @param {String} id - Identifier

    @return {String} - Double-quoted, safely escaped
    *********************************************************************/
    escapeIdentifier: function (id) {

      return '"' + String(id).replace(/"/g, '""') + '"';

    },


    /********************************************************************
    Escape a scalar value as an SQLite literal.
    - null / undefined -> NULL
    - boolean          -> 1 / 0 (SQLite has no native boolean; convention is INTEGER)
    - number           -> digit string (checked for NaN / Infinity)
    - bigint           -> digit string
    - Date             -> ISO 8601 string literal (TEXT convention)
    - Buffer           -> X'hex' BLOB literal
    - string           -> single-quoted, embedded quotes doubled

    @param {*} val - Scalar value

    @return {String} - SQLite-safe literal
    *********************************************************************/
    escapeValue: function (val) {

      if (val === null || val === undefined) {
        return 'NULL';
      }

      if (typeof val === 'boolean') {
        return val ? '1' : '0';
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
        return 'X\'' + val.toString('hex') + '\'';
      }

      // String (and anything else) - escape single quotes (standard SQL)
      const str = String(val);
      return '\'' + str.replace(/'/g, '\'\'') + '\'';

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
      if (val && typeof val === 'object' && val.__sqlite_raw__ === true) {
        return val.value;
      }

      // Array - comma-joined escaped literals (IN clause pattern)
      if (Array.isArray(val)) {
        return val.map(_SQLite.formatValue).join(', ');
      }

      // Plain object - "k1" = v1, "k2" = v2 (SET / WHERE expansion)
      if (val && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
        const pairs = [];
        Object.keys(val).forEach(function (key) {
          pairs.push(_SQLite.escapeIdentifier(key) + ' = ' + _SQLite.formatValue(val[key]));
        });
        return pairs.join(', ');
      }

      return _SQLite.escapeValue(val);

    },


    /********************************************************************
    Format a SQL template into a fully-escaped string.
    Mirrors mysql2.format / the Postgres equivalent on top of SQLite
    escape rules:
      - ?  scalar  -> escaped literal
      - ?  array   -> comma-joined escaped literals (for IN clauses)
      - ?  object  -> `"k1" = v1, "k2" = v2` (for SET/WHERE)
      - ?? scalar  -> double-quoted identifier
      - ?? array   -> comma-joined identifiers

    Walks inside single-quoted strings / double-quoted identifiers /
    line comments to avoid replacing placeholders there.

    @param {String} sql - Source SQL
    @param {*} params - Scalar, array, or object

    @return {String} - Fully-escaped SQLite SQL
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

        // Double-quoted identifier - emit verbatim (respect doubled "" escape)
        if (ch === '"') {
          out += ch;
          i++;
          while (i < sql.length) {
            const c = sql[i];
            out += c;
            i++;
            if (c === '"') {
              if (sql[i] === '"') {
                out += '"';
                i++;
                continue;
              }
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
            out += val.map(_SQLite.escapeIdentifier).join(', ');
          }
          else {
            out += _SQLite.escapeIdentifier(String(val));
          }
          i += 2;
          continue;
        }

        // ? - value / array / object
        if (ch === '?') {
          const val = values[value_idx++];
          out += _SQLite.formatValue(val);
          i++;
          continue;
        }

        out += ch;
        i++;

      }

      return out;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Placeholder / Param Translation ~~~~~~~~~~~~~~~~~~~~
    // SQLite natively supports ? placeholders, so we only need to inline
    // ?? identifiers. Also normalize parameter values that node:sqlite
    // cannot bind directly (booleans, Dates, undefined).

    /********************************************************************
    Translate ? / ?? placeholders for node:sqlite consumption:
      - ?  -> left as-is, value pushed to out_params in order
      - ?? -> inlined as a double-quoted identifier

    Walks the SQL character-by-character so placeholders inside string
    literals, double-quoted identifiers, and -- line comments are ignored.

    @param {String} sql - Source SQL with ?/?? placeholders
    @param {Array} params - Values to bind (consumed in order)

    @return {Object} - { sql, params } ready for prepare/run/all
    *********************************************************************/
    translatePlaceholders: function (sql, params) {

      // Fast path: no params, nothing to translate
      if (!params || params.length === 0) {
        return { sql: sql, params: [] };
      }

      let out = '';
      let param_idx = 0;
      const out_params = [];
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

        // Skip double-quoted identifiers (respect doubled "" escape)
        if (ch === '"') {
          out += ch;
          i++;
          while (i < sql.length) {
            const c = sql[i];
            out += c;
            i++;
            if (c === '"') {
              if (sql[i] === '"') {
                out += '"';
                i++;
                continue;
              }
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
          out += _SQLite.escapeIdentifier(String(val));
          i += 2;
          continue;
        }

        // ? - value (keep placeholder, push to params)
        if (ch === '?') {
          out_params.push(params[param_idx++]);
          out += '?';
          i++;
          continue;
        }

        out += ch;
        i++;

      }

      return { sql: out, params: out_params };

    },


    /********************************************************************
    Convert JS parameter values into SQLite-compatible bindable types.
    node:sqlite accepts: null | number | bigint | string | Buffer |
    TypedArray | DataView. We additionally support:
      - undefined -> null
      - boolean   -> 1 / 0
      - Date      -> ISO string

    @param {Array} params - Raw JS values

    @return {Array} - SQLite-bindable values
    *********************************************************************/
    normalizeParams: function (params) {

      return params.map(function (p) {
        if (p === undefined || p === null) {
          return null;
        }
        if (typeof p === 'boolean') {
          return p ? 1 : 0;
        }
        if (p instanceof Date) {
          return p.toISOString();
        }
        return p;
      });

    },


    /********************************************************************
    Classify a SQL statement as read-shape (returns rows) or write-shape
    (returns affected_rows / insert_id). Used by query() to decide whether
    to call statement.all() or statement.run().

    Read-shape: SELECT, WITH (CTE), PRAGMA, EXPLAIN, or any statement
    containing a RETURNING clause (INSERT/UPDATE/DELETE ... RETURNING *).

    @param {String} sql - SQL statement

    @return {Object} - { is_read, first_word, has_returning }
    *********************************************************************/
    classifyStatement: function (sql) {

      const trimmed = sql.trim();
      const match = trimmed.match(/^[a-zA-Z]+/);
      const first_word = match ? match[0].toUpperCase() : '';

      // Line-comment-insensitive RETURNING detection is overkill here -
      // the translator already preserved comments verbatim.
      const has_returning = /\bRETURNING\b/i.test(trimmed);

      const is_read_keyword = first_word === 'SELECT' ||
        first_word === 'WITH' ||
        first_word === 'PRAGMA' ||
        first_word === 'EXPLAIN';

      return {
        is_read: is_read_keyword || has_returning,
        first_word: first_word,
        has_returning: has_returning
      };

    },


    /********************************************************************
    Convert a bigint to number when it is safe; keep bigint otherwise.
    node:sqlite may return bigint for changes/lastInsertRowid; downstream
    JSON serialization prefers numbers when they fit in a safe integer.

    @param {*} val - Number or bigint

    @return {Number|BigInt} - Same value, narrowed when safe
    *********************************************************************/
    narrowInteger: function (val) {

      if (typeof val === 'bigint') {
        if (val <= BigInt(Number.MAX_SAFE_INTEGER) && val >= BigInt(Number.MIN_SAFE_INTEGER)) {
          return Number(val);
        }
        return val;
      }

      return val;

    },


    /********************************************************************
    Convert node:sqlite result rows (null-prototype objects) into plain
    objects so downstream consumers behave the same across MySQL / Postgres
    / SQLite. `deepStrictEqual`, spread, and JSON.stringify all assume plain
    Object prototypes.

    @param {Array} rows - Rows as returned by statement.all()

    @return {Array} - Same rows, each copied into a plain object
    *********************************************************************/
    normalizeRows: function (rows) {

      if (!Array.isArray(rows) || rows.length === 0) {
        return rows || [];
      }

      return rows.map(function (row) {
        return Object.assign({}, row);
      });

    },


    // ~~~~~~~~~~~~~~~~~~~~ Core SQL Execution ~~~~~~~~~~~~~~~~~~~~
    // The workhorses - all I/O routes through here in dependency order:
    // query -> execute|transaction

    /********************************************************************
    Run any SQL. The core workhorse - all other I/O functions route through here.
    Placeholders: ? for values, ?? for identifiers (?? inlined at runtime).

    Dispatches to statement.all() for read-shape queries and statement.run()
    for write-shape queries, based on classifyStatement().

    @param {Object} instance - Request instance (for time_ms tracing)
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, rows, affected_rows, insert_id, error }
    *********************************************************************/
    query: async function (instance, sql, params) {

      // Build handle on first call
      _SQLite.initIfNot();

      // Start performance timeline
      Lib.Debug.performanceAuditLog('Start', 'SQLite Query', instance['time_ms']);

      try {

        // Inline ?? identifiers; keep ? for native SQLite binding
        const compiled = _SQLite.translatePlaceholders(sql, params || []);

        // Prepare the statement and bind normalized params
        const stmt = state.db.prepare(compiled.sql);
        const bind = _SQLite.normalizeParams(compiled.params);

        // Dispatch based on statement shape
        const shape = _SQLite.classifyStatement(compiled.sql);

        if (shape.is_read) {

          // SELECT / WITH / PRAGMA / EXPLAIN / ... RETURNING * -> all()
          // Normalize null-prototype rows to plain objects for API parity.
          const rows = _SQLite.normalizeRows(stmt.all(...bind));

          // For INSERT ... RETURNING, surface changes via rows.length and
          // extract insert_id from the first returned row if present.
          let affected_rows = 0;
          let insert_id = null;

          if (shape.has_returning && !['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN'].includes(shape.first_word)) {
            affected_rows = rows.length;
            if (rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'id')) {
              insert_id = _SQLite.narrowInteger(rows[0].id);
            }
          }

          Lib.Debug.performanceAuditLog('End', 'SQLite Query', instance['time_ms']);

          return {
            success: true,
            rows: rows,
            affected_rows: affected_rows,
            insert_id: insert_id,
            error: null
          };

        }

        // DML / DDL -> run()
        const res = stmt.run(...bind);

        const affected_rows = _SQLite.narrowInteger(res.changes || 0);
        const last_id = _SQLite.narrowInteger(res.lastInsertRowid || 0);

        // Only surface insert_id for INSERT / REPLACE and when a row was actually inserted
        const is_insert = shape.first_word === 'INSERT' || shape.first_word === 'REPLACE';
        const insert_id = is_insert && last_id > 0 ? last_id : null;

        Lib.Debug.performanceAuditLog('End', 'SQLite Query', instance['time_ms']);

        return {
          success: true,
          rows: [],
          affected_rows: affected_rows,
          insert_id: insert_id,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('SQLite query failed', { error: error.message, code: error.code || null });

        return {
          success: false,
          rows: [],
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

    insert_id is populated automatically from sqlite3_last_insert_rowid() -
    no RETURNING clause is required (unlike Postgres). For UPDATE / DELETE
    insert_id will be null.

    @param {Object} instance - Request instance
    @param {String} sql - SQL with ?/?? placeholders
    @param {Array} [params] - Placeholder values

    @return {Promise<Object>} - { success, affected_rows, insert_id, error }
    *********************************************************************/
    execute: async function (instance, sql, params) {

      // Run the statement via the workhorse
      const result = await _SQLite.query(instance, sql, params);

      if (!result.success) {
        return {
          success: false,
          affected_rows: 0,
          insert_id: null,
          error: result.error
        };
      }

      return {
        success: true,
        affected_rows: result.affected_rows,
        insert_id: result.insert_id,
        error: null
      };

    },


    /********************************************************************
    Run many statements atomically. All commit, or all roll back.
    Internal helper used by write() for array input.

    Uses BEGIN / COMMIT / ROLLBACK since node:sqlite does not expose a
    transaction() wrapper.

    @param {Object} instance - Request instance
    @param {Array} statements - Array of { sql, params } objects

    @return {Promise<Object>} - { success, results, error }
    *********************************************************************/
    transaction: async function (instance, statements) {

      // Build handle on first call
      _SQLite.initIfNot();

      Lib.Debug.performanceAuditLog('Start', 'SQLite Transaction', instance['time_ms']);

      let begun = false;

      try {

        // Open the transaction
        state.db.exec('BEGIN');
        begun = true;

        // Run each statement sequentially on the same handle
        const results = [];
        for (let i = 0; i < statements.length; i++) {
          const stmt_def = statements[i];

          const compiled = _SQLite.translatePlaceholders(stmt_def.sql, stmt_def.params || []);
          const prepared = state.db.prepare(compiled.sql);
          const bind = _SQLite.normalizeParams(compiled.params);
          const shape = _SQLite.classifyStatement(compiled.sql);

          if (shape.is_read) {
            // Rare inside a transaction but handled for parity (e.g.
            // INSERT ... RETURNING *). Surface row count as affected_rows.
            const rows = _SQLite.normalizeRows(prepared.all(...bind));
            let insert_id = null;
            if (shape.has_returning && !['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN'].includes(shape.first_word)) {
              if (rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'id')) {
                insert_id = _SQLite.narrowInteger(rows[0].id);
              }
            }
            results.push({
              affected_rows: shape.has_returning ? rows.length : 0,
              insert_id: insert_id,
              rows: rows
            });
          }
          else {
            const res = prepared.run(...bind);
            const is_insert = shape.first_word === 'INSERT' || shape.first_word === 'REPLACE';
            const last_id = _SQLite.narrowInteger(res.lastInsertRowid || 0);
            results.push({
              affected_rows: _SQLite.narrowInteger(res.changes || 0),
              insert_id: is_insert && last_id > 0 ? last_id : null,
              rows: []
            });
          }
        }

        // Commit
        state.db.exec('COMMIT');
        begun = false;

        Lib.Debug.performanceAuditLog('End', 'SQLite Transaction', instance['time_ms']);

        return {
          success: true,
          results: results,
          error: null
        };

      }
      catch (error) {

        // Roll back if still open. Guard against rollback itself throwing.
        if (begun) {
          try { state.db.exec('ROLLBACK'); } catch { /* already failing - ignore */ }
        }

        Lib.Debug.debug('SQLite transaction failed', { error: error.message, code: error.code || null });

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
  return SQLite;

};/////////////////////////// createInterface END //////////////////////////////
