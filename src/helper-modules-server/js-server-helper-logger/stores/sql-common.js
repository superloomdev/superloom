// Info: Shared SQL store implementation for logger. Postgres, MySQL, and
// SQLite each get a thin wrapper that sets the dialect flag and defers
// to this factory. Identifier quoting and the LIMIT clause are the only
// dialect-specific parts; the schema is logically identical across all
// three.
//
// Schema (column lengths chosen so the composite PK and actor index
// stay under MySQL InnoDB's 3072-byte key limit at utf8mb4 4 bytes/char;
// SQLite ignores the lengths, Postgres has no equivalent constraint):
//
//   action_log
//     scope         VARCHAR(64)  NOT NULL
//     entity_type   VARCHAR(64)  NOT NULL
//     entity_id     VARCHAR(128) NOT NULL
//     actor_type    VARCHAR(64)  NOT NULL
//     actor_id      VARCHAR(128) NOT NULL
//     action        VARCHAR(128) NOT NULL
//     data          TEXT                -- JSON string
//     ip            VARCHAR(255)        -- encrypted hex when IP_ENCRYPT_KEY set
//     user_agent    TEXT
//     created_at    BIGINT NOT NULL     -- epoch seconds
//     created_at_ms BIGINT NOT NULL     -- epoch ms (for time-range filters)
//     sort_key      VARCHAR(64) NOT NULL -- ${created_at_ms}-${rand3}
//     expires_at    BIGINT               -- NULL = persistent
//     PRIMARY KEY (scope, entity_type, entity_id, sort_key)
//   INDEX action_log_actor_idx   (scope, actor_type, actor_id, sort_key)
//   INDEX action_log_expires_idx (expires_at)
//
// The composite PK lets listByEntity use an index-only read. The actor
// GSI mirrors that for listByActor. The expires_at index keeps
// cleanupExpiredRecords fast even on large tables.
'use strict';


const COLUMN_LIST = [
  'scope', 'entity_type', 'entity_id',
  'actor_type', 'actor_id', 'action',
  'data', 'ip', 'user_agent',
  'created_at', 'created_at_ms', 'sort_key', 'expires_at'
];


/********************************************************************
SQL store factory.

@param {Object} Lib - Dependency container (Utils, Debug).
@param {String} dialect - 'postgres' | 'mysql' | 'sqlite'.
@param {Object} store_config - `{ table_name, lib_sql }`.

@return {Object} - Store interface.
*********************************************************************/
module.exports = function sqlStoreFactory (Lib, dialect, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG must be an object for ' + dialect);
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.table_name) ||
    !Lib.Utils.isString(store_config.table_name) ||
    Lib.Utils.isEmptyString(store_config.table_name)
  ) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG.table_name is required for ' + dialect);
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_sql)) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG.lib_sql is required for ' + dialect + ' (pass Lib.Postgres / Lib.MySQL / Lib.SQLite)');
  }

  const sql = store_config.lib_sql;
  const table_name = store_config.table_name;
  const ddl = buildDDL(dialect, table_name);
  const insert_sql = buildInsertSQL(dialect, table_name);


  return {


    /********************************************************************
    Idempotent table + index creation.
    *********************************************************************/
    initialize: async function (instance) {
      for (const stmt of ddl) {
        const result = await sql.write(instance, stmt, []);
        if (result.success === false) {
          return { success: false, error: result.error };
        }
      }
      return { success: true, error: null };
    },


    /********************************************************************
    Insert a new log row. `data` is JSON-serialized for SQL storage.
    *********************************************************************/
    addRecord: async function (instance, record) {

      const result = await sql.write(
        instance,
        insert_sql,
        [
          record.scope,
          record.entity_type,
          record.entity_id,
          record.actor_type,
          record.actor_id,
          record.action,
          record.data === null ? null : JSON.stringify(record.data),
          record.ip,
          record.user_agent,
          record.created_at,
          record.created_at_ms,
          record.sort_key,
          record.expires_at
        ]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    List by entity. Primary-key range scan, sort_key descending.
    *********************************************************************/
    listByEntity: async function (instance, query) {

      const clauses = [
        quoteIdentifier(dialect, 'scope')       + ' = ?',
        quoteIdentifier(dialect, 'entity_type') + ' = ?',
        quoteIdentifier(dialect, 'entity_id')   + ' = ?'
      ];
      const params = [query.scope, query.entity_type, query.entity_id];

      _appendFilters(dialect, clauses, params, query);

      return _runListQuery(instance, sql, dialect, table_name, clauses, params, query.limit);

    },


    /********************************************************************
    List by actor. Uses the actor GSI.
    *********************************************************************/
    listByActor: async function (instance, query) {

      const clauses = [
        quoteIdentifier(dialect, 'scope')      + ' = ?',
        quoteIdentifier(dialect, 'actor_type') + ' = ?',
        quoteIdentifier(dialect, 'actor_id')   + ' = ?'
      ];
      const params = [query.scope, query.actor_type, query.actor_id];

      _appendFilters(dialect, clauses, params, query);

      return _runListQuery(instance, sql, dialect, table_name, clauses, params, query.limit);

    },


    /********************************************************************
    Bulk delete by expires_at. Persistent rows (expires_at IS NULL) are
    skipped by the predicate.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;

      const result = await sql.write(
        instance,
        'DELETE FROM ' + quoteIdentifier(dialect, table_name) +
        ' WHERE ' + quoteIdentifier(dialect, 'expires_at') + ' IS NOT NULL' +
        '   AND ' + quoteIdentifier(dialect, 'expires_at') + ' < ?',
        [now]
      );

      if (result.success === false) {
        return { success: false, deleted_count: 0, error: result.error };
      }

      return {
        success: true,
        deleted_count: result.affected_rows || 0,
        error: null
      };

    }


  };

};


/********************************************************************
Append the optional filter clauses (time range, action patterns,
pagination cursor) to an existing WHERE clause list.
*********************************************************************/
function _appendFilters (dialect, clauses, params, query) {

  if (query.start_time_ms !== null) {
    clauses.push(quoteIdentifier(dialect, 'created_at_ms') + ' >= ?');
    params.push(query.start_time_ms);
  }
  if (query.end_time_ms !== null) {
    clauses.push(quoteIdentifier(dialect, 'created_at_ms') + ' < ?');
    params.push(query.end_time_ms);
  }

  if (query.actions !== null && query.actions.length > 0) {
    const action_sql = [];
    for (const pattern of query.actions) {
      if (pattern.endsWith('.*')) {
        action_sql.push(quoteIdentifier(dialect, 'action') + ' LIKE ?');
        params.push(pattern.slice(0, -2) + '.%');
      } else {
        action_sql.push(quoteIdentifier(dialect, 'action') + ' = ?');
        params.push(pattern);
      }
    }
    clauses.push('(' + action_sql.join(' OR ') + ')');
  }

  // Pagination cursor - the previous page's last sort_key. We want rows
  // strictly older than it (smaller sort_key, since the stream is DESC).
  if (query.cursor !== null) {
    clauses.push(quoteIdentifier(dialect, 'sort_key') + ' < ?');
    params.push(query.cursor);
  }

}


/********************************************************************
Execute a SELECT with the given WHERE clauses, sort desc, apply limit.
*********************************************************************/
async function _runListQuery (instance, sql_lib, dialect, table_name, clauses, params, limit) {

  const t = quoteIdentifier(dialect, table_name);
  const columns = COLUMN_LIST.map(function (c) { return quoteIdentifier(dialect, c); }).join(', ');
  const where = clauses.join(' AND ');

  const result = await sql_lib.getRows(
    instance,
    'SELECT ' + columns + ' FROM ' + t +
    ' WHERE ' + where +
    ' ORDER BY ' + quoteIdentifier(dialect, 'sort_key') + ' DESC' +
    ' LIMIT ' + Number(limit),
    params
  );

  if (result.success === false) {
    return { success: false, records: [], next_cursor: null, error: result.error };
  }

  const records = result.rows.map(function (row) {
    return _deserializeRow(row);
  });

  // Next cursor = sort_key of the last row when the page is full, else null.
  const next_cursor = records.length === Number(limit) ? records[records.length - 1].sort_key : null;

  return { success: true, records: records, next_cursor: next_cursor, error: null };

}


/********************************************************************
Translate a raw DB row into the store's canonical record shape. Parses
the JSON `data` blob. Nulls preserved so persistent rows come back
with `expires_at: null` rather than a sentinel value.
*********************************************************************/
function _deserializeRow (row) {

  let data_value = null;
  if (row.data !== null && row.data !== undefined && row.data !== '') {
    try {
      data_value = JSON.parse(row.data);
    } catch {
      data_value = null;
    }
  }

  return {
    scope:         row.scope,
    entity_type:   row.entity_type,
    entity_id:     row.entity_id,
    actor_type:    row.actor_type,
    actor_id:      row.actor_id,
    action:        row.action,
    data:          data_value,
    ip:            row.ip === undefined ? null : row.ip,
    user_agent:    row.user_agent === undefined ? null : row.user_agent,
    created_at:    Number(row.created_at),
    created_at_ms: Number(row.created_at_ms),
    sort_key:      row.sort_key,
    expires_at:    (row.expires_at === null || row.expires_at === undefined) ? null : Number(row.expires_at)
  };

}


/********************************************************************
Quote an identifier per dialect. MySQL uses backticks; Postgres and
SQLite use double quotes.
*********************************************************************/
function quoteIdentifier (dialect, name) {
  if (dialect === 'mysql') {
    return '`' + name + '`';
  }
  return '"' + name + '"';
}


/********************************************************************
Build the INSERT statement. Simple - no conflict handling because log
rows are append-only.
*********************************************************************/
function buildInsertSQL (dialect, table_name) {

  const t = quoteIdentifier(dialect, table_name);
  const cols = COLUMN_LIST.map(function (c) { return quoteIdentifier(dialect, c); }).join(', ');
  const placeholders = COLUMN_LIST.map(function () { return '?'; }).join(', ');

  return 'INSERT INTO ' + t + ' (' + cols + ') VALUES (' + placeholders + ')';

}


/********************************************************************
Build the CREATE TABLE + CREATE INDEX DDL. Returned as an array of
statements so the initialize() function can execute them sequentially.

VARCHAR sizes are deliberately moderate so the composite primary key
(scope + entity_type + entity_id + sort_key) and actor index stay
under MySQL InnoDB's 3072-byte key limit (utf8mb4 = 4 bytes/char).
SQLite's affinity rules ignore the length so it stores everything as
TEXT regardless. Postgres has no equivalent limit.
*********************************************************************/
function buildDDL (dialect, table_name) {

  const t = quoteIdentifier(dialect, table_name);
  const actor_idx_name = table_name + '_actor_idx';
  const expires_idx_name = table_name + '_expires_idx';

  // SQLite uses INTEGER for any integer width and TEXT for any string;
  // declared lengths are ignored. We still emit them so the schema
  // documents the intended bounds.
  const big = (dialect === 'sqlite') ? 'INTEGER' : 'BIGINT';
  const varchar = function (n) {
    return (dialect === 'sqlite') ? 'TEXT' : 'VARCHAR(' + n + ')';
  };
  const text_type = 'TEXT';

  const create_table_columns = [
    '  ' + quoteIdentifier(dialect, 'scope')         + ' ' + varchar(64)  + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'entity_type')   + ' ' + varchar(64)  + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'entity_id')     + ' ' + varchar(128) + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'actor_type')    + ' ' + varchar(64)  + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'actor_id')      + ' ' + varchar(128) + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'action')        + ' ' + varchar(128) + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'data')          + ' ' + text_type,
    '  ' + quoteIdentifier(dialect, 'ip')            + ' ' + varchar(255),
    '  ' + quoteIdentifier(dialect, 'user_agent')    + ' ' + text_type,
    '  ' + quoteIdentifier(dialect, 'created_at')    + ' ' + big + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'created_at_ms') + ' ' + big + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'sort_key')      + ' ' + varchar(64) + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'expires_at')    + ' ' + big,
    '  PRIMARY KEY (' +
      quoteIdentifier(dialect, 'scope') + ', ' +
      quoteIdentifier(dialect, 'entity_type') + ', ' +
      quoteIdentifier(dialect, 'entity_id') + ', ' +
      quoteIdentifier(dialect, 'sort_key') + ')'
  ];

  if (dialect === 'mysql') {
    // MySQL pre-8.0.20 lacks `CREATE INDEX IF NOT EXISTS` - inline both
    // indexes in the CREATE TABLE statement.
    create_table_columns.push(
      '  INDEX ' + quoteIdentifier(dialect, actor_idx_name) +
      ' (' + quoteIdentifier(dialect, 'scope') + ', ' +
        quoteIdentifier(dialect, 'actor_type') + ', ' +
        quoteIdentifier(dialect, 'actor_id') + ', ' +
        quoteIdentifier(dialect, 'sort_key') + ')'
    );
    create_table_columns.push(
      '  INDEX ' + quoteIdentifier(dialect, expires_idx_name) +
      ' (' + quoteIdentifier(dialect, 'expires_at') + ')'
    );
    return [
      'CREATE TABLE IF NOT EXISTS ' + t + ' (\n' +
      create_table_columns.join(',\n') + '\n)'
    ];
  }

  // Postgres + SQLite: CREATE TABLE then CREATE INDEX IF NOT EXISTS
  return [
    'CREATE TABLE IF NOT EXISTS ' + t + ' (\n' +
    create_table_columns.join(',\n') + '\n)',
    'CREATE INDEX IF NOT EXISTS ' + quoteIdentifier(dialect, actor_idx_name) +
      ' ON ' + t + ' (' +
      quoteIdentifier(dialect, 'scope') + ', ' +
      quoteIdentifier(dialect, 'actor_type') + ', ' +
      quoteIdentifier(dialect, 'actor_id') + ', ' +
      quoteIdentifier(dialect, 'sort_key') + ')',
    'CREATE INDEX IF NOT EXISTS ' + quoteIdentifier(dialect, expires_idx_name) +
      ' ON ' + t + ' (' + quoteIdentifier(dialect, 'expires_at') + ')'
  ];

}


// White-box hooks for tests
module.exports._buildDDL = buildDDL;
module.exports._buildInsertSQL = buildInsertSQL;
