// Info: Tests for js-server-helper-sqlite.
// Runs entirely offline against an in-memory SQLite database
// (or a file path if SQLITE_FILE is exported). No Docker, no credentials.
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const ERRORS = require('../sqlite.errors');

// Load dependencies via test loader — process.env is touched only there.
const { Lib } = require('./loader')();
const SQLite = Lib.SQLite;
const Instance = Lib.Instance;

// Single test instance — represents a "request" for performance timeline.
const instance = Instance.initialize();

// Test table name — keep simple and unique
const TEST_TABLE = 'test_table';



describe('SQLite', { concurrency: false }, function () {


// ============================================================================
// 0. TABLE SETUP / TEARDOWN
// ----------------------------------------------------------------------------
// SQLite has no separate admin server. We reuse the module's own handle via
// getClient() to run DDL — this keeps setup/teardown isolated from the
// module's public write() API.
// ============================================================================

before(async function () {

  const { client } = await SQLite.getClient(instance);

  client.exec('DROP TABLE IF EXISTS ' + TEST_TABLE);

  client.exec(
    'CREATE TABLE ' + TEST_TABLE + ' (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  p_id TEXT NOT NULL UNIQUE,' +
    '  col_1 TEXT NULL,' +
    '  col_2 TEXT NULL,' +
    '  col_3 INTEGER NULL,' +
    '  col_4 INTEGER DEFAULT 1' +
    ')'
  );

});


after(async function () {

  const { client } = await SQLite.getClient(instance);
  client.exec('DROP TABLE IF EXISTS ' + TEST_TABLE);

  await SQLite.close();

});



// ============================================================================
// 1. buildQuery / buildRawText / buildMultiCondition — pure, no I/O
// ============================================================================

describe('buildQuery', function () {

  it('should substitute ? placeholders with escaped values', function () {

    const sql = SQLite.buildQuery('SELECT * FROM ?? WHERE ?? = ?', [TEST_TABLE, 'id', 42]);

    assert.strictEqual(
      sql,
      'SELECT * FROM "' + TEST_TABLE + '" WHERE "id" = 42'
    );

  });

  it('should escape string values safely', function () {

    const sql = SQLite.buildQuery('SELECT ? AS x', ['Hello \' World']);

    assert.strictEqual(sql, "SELECT 'Hello '' World' AS x");

  });

  it('should serialize an object via SET ?', function () {

    const sql = SQLite.buildQuery('INSERT INTO test SET ?', { id: 1, name: 'Alice' });

    assert.strictEqual(sql, "INSERT INTO test SET \"id\" = 1, \"name\" = 'Alice'");

  });

  it('should serialize booleans (1/0) and nulls', function () {

    const sql = SQLite.buildQuery('SELECT ?, ?, ?', [true, false, null]);

    assert.strictEqual(sql, 'SELECT 1, 0, NULL');

  });

  it('should keep backslashes literal (no E-escape like Postgres)', function () {

    const sql = SQLite.buildQuery('SELECT ?', ['back\\slash']);

    assert.strictEqual(sql, "SELECT 'back\\slash'");

  });

});


describe('buildRawText', function () {

  it('should embed a raw fragment without escaping', function () {

    const raw = SQLite.buildRawText('CURRENT_TIMESTAMP');
    const sql = SQLite.buildQuery('INSERT INTO test SET ?', { created_at: raw });

    assert.strictEqual(sql, 'INSERT INTO test SET "created_at" = CURRENT_TIMESTAMP');

  });

  it('should embed nested function calls unescaped', function () {

    const fn = SQLite.buildRawText("json_extract(data, '$.name')");
    const sql = SQLite.buildQuery('UPDATE t SET ?', { name: fn });

    assert.strictEqual(
      sql,
      "UPDATE t SET \"name\" = json_extract(data, '$.name')"
    );

  });

});


describe('buildMultiCondition', function () {

  it('should default to AND', function () {

    const cond = SQLite.buildMultiCondition({ id: 1, name: 'Alice' });

    assert.strictEqual(cond, " \"id\" = 1  AND  \"name\" = 'Alice' ");

  });

  it('should join with OR when specified', function () {

    const cond = SQLite.buildMultiCondition({ a: 1, b: 2 }, 'OR');

    assert.strictEqual(cond, ' "a" = 1  OR  "b" = 2 ');

  });

});



// ============================================================================
// 2. write (single statement) + getRow / getRows / getValue
// ============================================================================

describe('write (single statement)', function () {

  it('should INSERT a row and return affected_rows + insert_id (no RETURNING needed)', async function () {

    const res = await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1, col_2, col_3, col_4) VALUES (?, ?, ?, ?, ?)',
      [TEST_TABLE, 'row1', 'hello', 'abc', 1, true]
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 1);
    assert.ok(res.insert_id > 0);
    assert.strictEqual(res.error, null);

  });

  it('should UPDATE a row', async function () {

    const res = await SQLite.write(
      instance,
      'UPDATE ?? SET col_3 = ? WHERE p_id = ?',
      [TEST_TABLE, 999, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 1);
    assert.strictEqual(res.insert_id, null);

  });

  it('should return error on malformed SQL', async function () {

    const res = await SQLite.write(instance, 'INSERT INTO does_not_exist VALUES (?)', [1]);

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.type, ERRORS.DATABASE_QUERY_FAILED.type);
    assert.ok(res.error.message.length > 0);

  });

});


describe('getRow', function () {

  it('should return the first row', async function () {

    const res = await SQLite.getRow(
      instance,
      'SELECT p_id, col_1, col_3 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.row, { p_id: 'row1', col_1: 'hello', col_3: 999 });

  });

  it('should return null when no row matches', async function () {

    const res = await SQLite.getRow(
      instance,
      'SELECT * FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'nope']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.row, null);

  });

});


describe('getRows', function () {

  it('should return all rows with count', async function () {

    // Seed a second row
    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'row2', 'second']
    );

    const res = await SQLite.getRows(
      instance,
      'SELECT p_id FROM ?? ORDER BY p_id ASC',
      [TEST_TABLE]
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.rows[0].p_id, 'row1');
    assert.strictEqual(res.rows[1].p_id, 'row2');

  });

});


describe('getValue', function () {

  it('should return a scalar for single-column single-row queries', async function () {

    const res = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? ',
      [TEST_TABLE]
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.value, 2);

  });

  it('should return null when no row matches', async function () {

    const res = await SQLite.getValue(
      instance,
      'SELECT col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'nope']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.value, null);

  });

});



// ============================================================================
// 3. write (atomic transaction via array) + manual client
// ============================================================================

describe('write (atomic transaction)', function () {

  it('should commit all statements when all succeed', async function () {

    const res = await SQLite.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx1', 'a'] },
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx2', 'b'] }
    ]);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);
    assert.ok(res.insert_id > 0);

    const count = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id IN (?, ?)',
      [TEST_TABLE, 'tx1', 'tx2']
    );
    assert.strictEqual(count.value, 2);

  });

  it('should roll back all statements when any fails', async function () {

    const res = await SQLite.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx3', 'a'] },
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx1', 'dup'] }
      // duplicate unique key - transaction must roll back
    ]);

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.type, ERRORS.DATABASE_TRANSACTION_FAILED.type);

    const count = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'tx3']
    );
    assert.strictEqual(count.value, 0);

  });

});


describe('getClient / releaseClient', function () {

  it('should return the DatabaseSync handle and allow direct use', async function () {

    const res = await SQLite.getClient(instance);

    assert.strictEqual(res.success, true);
    assert.ok(res.client);
    assert.strictEqual(typeof res.client.prepare, 'function');
    assert.strictEqual(typeof res.client.exec, 'function');

    const row = res.client.prepare('SELECT 1 AS one').get();
    assert.strictEqual(row.one, 1);

    // releaseClient is a no-op but must be safe to call
    SQLite.releaseClient(res.client);
    SQLite.releaseClient(null);

  });

});



// ============================================================================
// 4. Auto-shaping helper: get + write polymorphic input
// ============================================================================

describe('get', function () {

  it('should return null when no row matches', async function () {

    const res = await SQLite.get(
      instance,
      'SELECT * FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'nope']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result, null);
    assert.strictEqual(res.has_multiple_rows, false);

  });

  it('should return a scalar when single column single row', async function () {

    const res = await SQLite.get(
      instance,
      'SELECT col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result, 'hello');
    assert.strictEqual(res.has_multiple_rows, false);

  });

  it('should return a row object when single multi-column row', async function () {

    const res = await SQLite.get(
      instance,
      'SELECT p_id, col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.result, { p_id: 'row1', col_1: 'hello' });
    assert.strictEqual(res.has_multiple_rows, false);

  });

  it('should return array with has_multiple_rows=true for many', async function () {

    const res = await SQLite.get(
      instance,
      'SELECT p_id FROM ?? ORDER BY p_id',
      [TEST_TABLE]
    );

    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.result));
    assert.strictEqual(res.has_multiple_rows, true);
    assert.ok(res.result.length >= 2);

  });

});


describe('write (pre-built SQL strings)', function () {

  it('should no-op on empty array', async function () {

    const res = await SQLite.write(instance, []);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 0);

  });

  it('should execute single pre-built SQL string', async function () {

    const sql = SQLite.buildQuery(
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'lg1', 'legacy']
    );

    const res = await SQLite.write(instance, sql);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 1);
    assert.ok(res.insert_id > 0);

  });

  it('should execute array of pre-built SQL strings transactionally', async function () {

    const sql = [
      SQLite.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg2', 'a']),
      SQLite.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg3', 'b'])
    ];

    const res = await SQLite.write(instance, sql);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);

  });

  it('should roll back array when any statement fails', async function () {

    const sql = [
      SQLite.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg4', 'a']),
      SQLite.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg1', 'dup'])
    ];

    const res = await SQLite.write(instance, sql);

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.type, ERRORS.DATABASE_TRANSACTION_FAILED.type);

    const count = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'lg4']
    );
    assert.strictEqual(count.value, 0);

  });

});



// ============================================================================
// 5. Multiple-instance support — core reason for the closure-per-loader design
// ============================================================================

describe('multiple instances', function () {

  it('should allow independent handles via multiple loader calls', async function () {

    const ModuleFactory = require('@superloomdev/js-server-helper-sql-sqlite');

    // Two separate in-memory databases — truly independent state
    const A = ModuleFactory(Lib, {
      FILE: ':memory:',
      JOURNAL_MODE: 'MEMORY'
    });
    const B = ModuleFactory(Lib, {
      FILE: ':memory:',
      JOURNAL_MODE: 'MEMORY'
    });

    const ra = await A.getValue(instance, 'SELECT 1 AS x');
    const rb = await B.getValue(instance, 'SELECT 2 AS x');

    assert.strictEqual(ra.value, 1);
    assert.strictEqual(rb.value, 2);

    // Verify isolation: create a table in A, confirm it does NOT exist in B
    await A.write(instance, 'CREATE TABLE isolation_check (id INTEGER)');
    const existsInA = await A.getValue(
      instance,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'isolation_check'"
    );
    const existsInB = await B.getValue(
      instance,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'isolation_check'"
    );
    assert.strictEqual(existsInA.value, 1);
    assert.strictEqual(existsInB.value, 0);

    await A.close();
    await B.close();

  });

});



// ============================================================================
// 6. Placeholder translator — edge cases
// ============================================================================

describe('placeholder translator', function () {

  it('should ignore ? inside single-quoted string literals', async function () {

    const res = await SQLite.getValue(
      instance,
      "SELECT 'hello ? world' AS x"
    );
    assert.strictEqual(res.value, 'hello ? world');

  });

  it('should handle ? mixed with string literal containing single quote', async function () {

    const res = await SQLite.getValue(
      instance,
      "SELECT ? AS x WHERE 'can''t' = 'can''t'",
      ['ok']
    );
    assert.strictEqual(res.value, 'ok');

  });

  it('should handle SQL with no ? translation when no params', async function () {

    const res = await SQLite.getValue(instance, 'SELECT 1 AS x');
    assert.strictEqual(res.value, 1);

  });

  it('should handle IN clause with array params', async function () {

    const sql = SQLite.buildQuery(
      'SELECT COUNT(*) FROM ?? WHERE p_id IN (?)',
      [TEST_TABLE, ['row1', 'row2']]
    );
    const res = await SQLite.getValue(instance, sql);
    assert.strictEqual(res.value, 2);

  });

});



// ============================================================================
// 7. SQLite-specific features: RETURNING, type coercion, PRAGMA
// ============================================================================

describe('SQLite-specific: RETURNING clause', function () {

  it('should route INSERT ... RETURNING through the read path and surface insert_id', async function () {

    const res = await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?) RETURNING id, p_id',
      [TEST_TABLE, 'ret1', 'returned']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 1);
    assert.ok(res.insert_id > 0);

  });

  it('should return the RETURNING row via get helpers', async function () {

    const res = await SQLite.get(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?) RETURNING id, p_id, col_1',
      [TEST_TABLE, 'ret2', 'fetched']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.has_multiple_rows, false);
    assert.strictEqual(res.result.p_id, 'ret2');
    assert.strictEqual(res.result.col_1, 'fetched');
    assert.ok(res.result.id > 0);

  });

});


describe('SQLite-specific: JS type coercion on bind', function () {

  it('should accept Date and store as ISO string', async function () {

    const now = new Date('2024-01-15T12:34:56.000Z');

    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'date1', now]
    );

    const row = await SQLite.getRow(
      instance,
      'SELECT col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'date1']
    );

    assert.strictEqual(row.row.col_1, '2024-01-15T12:34:56.000Z');

  });

  it('should coerce booleans to 1 and 0', async function () {

    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_4) VALUES (?, ?)',
      [TEST_TABLE, 'bool1', false]
    );

    const val = await SQLite.getValue(
      instance,
      'SELECT col_4 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'bool1']
    );

    assert.strictEqual(val.value, 0);

  });

  it('should coerce undefined to NULL', async function () {

    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'undef1', undefined]
    );

    const row = await SQLite.getRow(
      instance,
      'SELECT col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'undef1']
    );

    assert.strictEqual(row.row.col_1, null);

  });

});


describe('SQLite-specific: PRAGMA', function () {

  it('should expose PRAGMA via get helpers (read-shape classification)', async function () {

    const res = await SQLite.get(instance, 'PRAGMA foreign_keys');

    assert.strictEqual(res.success, true);
    // Result shape: single row, single column -> scalar. Value is 1 (enabled by default config).
    assert.strictEqual(res.result, 1);

  });

});



// ============================================================================
// 8. Rigorous edge cases: formatQuery (escapeValue, formatValue, parser)
// ============================================================================

describe('formatQuery — escapeValue edge cases', function () {

  it('should throw on NaN', function () {

    assert.throws(function () {
      SQLite.buildQuery('SELECT ?', [NaN]);
    }, /non-finite/i);

  });

  it('should throw on Infinity', function () {

    assert.throws(function () {
      SQLite.buildQuery('SELECT ?', [Infinity]);
    }, /non-finite/i);

  });

  it('should throw on -Infinity', function () {

    assert.throws(function () {
      SQLite.buildQuery('SELECT ?', [-Infinity]);
    }, /non-finite/i);

  });

  it('should serialize bigint values', function () {

    const sql = SQLite.buildQuery('SELECT ?', [BigInt('9007199254740993')]);
    assert.strictEqual(sql, 'SELECT 9007199254740993');

  });

  it('should serialize Buffer as X\'hex\' blob literal', function () {

    const buf = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
    const sql = SQLite.buildQuery('SELECT ?', [buf]);
    assert.strictEqual(sql, "SELECT X'deadbeef'");

  });

  it('should serialize Date as ISO string literal', function () {

    const d = new Date('2024-06-15T09:30:00.000Z');
    const sql = SQLite.buildQuery('SELECT ?', [d]);
    assert.strictEqual(sql, "SELECT '2024-06-15T09:30:00.000Z'");

  });

  it('should serialize undefined as NULL', function () {

    const sql = SQLite.buildQuery('SELECT ?', [undefined]);
    assert.strictEqual(sql, 'SELECT NULL');

  });

  it('should double single quotes inside strings', function () {

    const sql = SQLite.buildQuery('SELECT ?', ["it's a 'test'"]);
    assert.strictEqual(sql, "SELECT 'it''s a ''test'''");

  });

  it('should handle empty string', function () {

    const sql = SQLite.buildQuery('SELECT ?', ['']);
    assert.strictEqual(sql, "SELECT ''");

  });

  it('should handle zero', function () {

    const sql = SQLite.buildQuery('SELECT ?', [0]);
    assert.strictEqual(sql, 'SELECT 0');

  });

  it('should handle negative numbers', function () {

    const sql = SQLite.buildQuery('SELECT ?', [-42.5]);
    assert.strictEqual(sql, 'SELECT -42.5');

  });

});


describe('formatQuery — parser edge cases', function () {

  it('should not substitute ? inside single-quoted strings', function () {

    const sql = SQLite.buildQuery("SELECT '?' AS x, ?", ['real']);
    assert.strictEqual(sql, "SELECT '?' AS x, 'real'");

  });

  it('should not substitute ? inside double-quoted identifiers', function () {

    const sql = SQLite.buildQuery('SELECT "col?" AS x, ?', ['val']);
    assert.strictEqual(sql, "SELECT \"col?\" AS x, 'val'");

  });

  it('should handle doubled single quotes inside string and still find ? after', function () {

    const sql = SQLite.buildQuery("SELECT 'it''s' AS x, ?", [42]);
    assert.strictEqual(sql, "SELECT 'it''s' AS x, 42");

  });

  it('should handle doubled double quotes inside identifier and still find ? after', function () {

    const sql = SQLite.buildQuery('SELECT "col""name" AS x, ?', [42]);
    assert.strictEqual(sql, 'SELECT "col""name" AS x, 42');

  });

  it('should not substitute ? inside -- line comments', function () {

    const sql = SQLite.buildQuery("SELECT 1 -- is this a ?\nAS x, ?", ['real']);
    assert.ok(sql.includes('-- is this a ?'));
    assert.ok(sql.includes("'real'"));

  });

  it('should handle multiple ?? identifiers in sequence', function () {

    const sql = SQLite.buildQuery('SELECT ??, ?? FROM ??', ['col1', 'col2', 'tbl']);
    assert.strictEqual(sql, 'SELECT "col1", "col2" FROM "tbl"');

  });

  it('should handle ?? with an array of identifiers', function () {

    const sql = SQLite.buildQuery('SELECT ?? FROM t', [['a', 'b', 'c']]);
    assert.strictEqual(sql, 'SELECT "a", "b", "c" FROM t');

  });

  it('should handle ? with an array for IN clause', function () {

    const sql = SQLite.buildQuery('SELECT * FROM t WHERE id IN (?)', [[1, 2, 3]]);
    assert.strictEqual(sql, 'SELECT * FROM t WHERE id IN (1, 2, 3)');

  });

  it('should handle SET ? with an object', function () {

    const sql = SQLite.buildQuery('UPDATE t SET ? WHERE id = ?', [{ name: 'Alice', age: 30 }, 5]);
    assert.strictEqual(sql, 'UPDATE t SET "name" = \'Alice\', "age" = 30 WHERE id = 5');

  });

  it('should handle WHERE ? with an object', function () {

    const sql = SQLite.buildQuery('SELECT * FROM t WHERE ?', [{ a: 1, b: 'x' }]);
    assert.strictEqual(sql, "SELECT * FROM t WHERE \"a\" = 1, \"b\" = 'x'");

  });

  it('should handle no params (return sql unchanged)', function () {

    const sql = SQLite.buildQuery('SELECT 1 AS x');
    assert.strictEqual(sql, 'SELECT 1 AS x');

  });

  it('should handle null params', function () {

    const sql = SQLite.buildQuery('SELECT 1 AS x', null);
    assert.strictEqual(sql, 'SELECT 1 AS x');

  });

  it('should handle a scalar param (non-array, non-object)', function () {

    const sql = SQLite.buildQuery('SELECT ?', 42);
    assert.strictEqual(sql, 'SELECT 42');

  });

});


describe('buildMultiCondition — raw text and complex values', function () {

  it('should support buildRawText in condition values', function () {

    const raw = SQLite.buildRawText('CURRENT_TIMESTAMP');
    const cond = SQLite.buildMultiCondition({ updated_at: raw, id: 5 });
    assert.ok(cond.includes('CURRENT_TIMESTAMP'));
    assert.ok(cond.includes('"id" = 5'));
    assert.ok(cond.includes('"updated_at" = CURRENT_TIMESTAMP'));

  });

  it('should handle null values in conditions', function () {

    const cond = SQLite.buildMultiCondition({ col: null });
    assert.strictEqual(cond, ' "col" = NULL ');

  });

  it('should handle boolean values in conditions', function () {

    const cond = SQLite.buildMultiCondition({ active: true, deleted: false });
    assert.ok(cond.includes('"active" = 1'));
    assert.ok(cond.includes('"deleted" = 0'));

  });

});



// ============================================================================
// 9. Rigorous edge cases: translatePlaceholders (runtime execution path)
// ============================================================================

describe('translatePlaceholders — runtime execution edge cases', function () {

  it('should handle mixed ?? and ? in same query', async function () {

    const res = await SQLite.getRow(
      instance,
      'SELECT ?? FROM ?? WHERE ?? = ?',
      ['col_1', TEST_TABLE, 'p_id', 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.row.col_1, 'hello');

  });

  it('should handle ? inside single-quoted literal followed by real ?', async function () {

    const res = await SQLite.getValue(
      instance,
      "SELECT CASE WHEN '?' = '?' THEN ? ELSE 0 END AS x",
      [99]
    );
    assert.strictEqual(res.value, 99);

  });

  it('should handle doubled single quotes followed by real ?', async function () {

    const res = await SQLite.getValue(
      instance,
      "SELECT CASE WHEN 'can''t' = 'can''t' THEN ? ELSE 0 END AS x",
      [77]
    );
    assert.strictEqual(res.value, 77);

  });

  it('should handle ?? that produces identifier with special chars', async function () {

    // Create a table with a column that has spaces in the name
    const { client } = await SQLite.getClient(instance);
    client.exec('CREATE TABLE IF NOT EXISTS "edge_case" ("my col" TEXT)');
    await SQLite.write(
      instance,
      'INSERT INTO "edge_case" (??) VALUES (?)',
      ['my col', 'works']
    );

    const res = await SQLite.getValue(
      instance,
      'SELECT ?? FROM "edge_case"',
      ['my col']
    );
    assert.strictEqual(res.value, 'works');

    client.exec('DROP TABLE IF EXISTS "edge_case"');

  });

});



// ============================================================================
// 10. Rigorous edge cases: classifyStatement
// ============================================================================

describe('classifyStatement — via public API', function () {

  it('should classify WITH (CTE) as read-shape', async function () {

    const res = await SQLite.getRows(
      instance,
      'WITH cte AS (SELECT p_id FROM ?? LIMIT 1) SELECT * FROM cte',
      [TEST_TABLE]
    );

    assert.strictEqual(res.success, true);
    assert.ok(res.count >= 1);

  });

  it('should classify EXPLAIN as read-shape', async function () {

    const res = await SQLite.getRows(
      instance,
      'EXPLAIN SELECT * FROM ??',
      [TEST_TABLE]
    );

    assert.strictEqual(res.success, true);
    assert.ok(res.count >= 1);

  });

  it('should classify DELETE ... RETURNING as read-shape and surface rows', async function () {

    // Seed a row to delete
    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'del_ret', 'bye']
    );

    const res = await SQLite.get(
      instance,
      'DELETE FROM ?? WHERE p_id = ? RETURNING p_id, col_1',
      [TEST_TABLE, 'del_ret']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result.p_id, 'del_ret');
    assert.strictEqual(res.result.col_1, 'bye');

    // Verify it was actually deleted
    const check = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'del_ret']
    );
    assert.strictEqual(check.value, 0);

  });

  it('should classify UPDATE ... RETURNING as read-shape and surface rows', async function () {

    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'upd_ret', 'old']
    );

    const res = await SQLite.get(
      instance,
      'UPDATE ?? SET col_1 = ? WHERE p_id = ? RETURNING p_id, col_1',
      [TEST_TABLE, 'new', 'upd_ret']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result.p_id, 'upd_ret');
    assert.strictEqual(res.result.col_1, 'new');

  });

});



// ============================================================================
// 11. Rigorous edge cases: write() null/undefined/empty edge cases
// ============================================================================

describe('write — null/undefined/empty input', function () {

  it('should no-op on null', async function () {

    const res = await SQLite.write(instance, null);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 0);
    assert.strictEqual(res.insert_id, null);

  });

  it('should no-op on undefined', async function () {

    const res = await SQLite.write(instance, undefined);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 0);

  });

  it('should no-op on empty array', async function () {

    const res = await SQLite.write(instance, []);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 0);

  });

});



// ============================================================================
// 12. Rigorous edge cases: transaction with mixed statement types
// ============================================================================

describe('write (transaction) — mixed statement types', function () {

  it('should handle INSERT + UPDATE in same transaction and aggregate affected_rows', async function () {

    const res = await SQLite.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'mix1', 'a'] },
      { sql: 'UPDATE ?? SET col_1 = ? WHERE p_id = ?', params: [TEST_TABLE, 'updated', 'mix1'] }
    ]);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);

    // Verify the UPDATE actually took effect
    const row = await SQLite.getRow(
      instance,
      'SELECT col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'mix1']
    );
    assert.strictEqual(row.row.col_1, 'updated');

  });

  it('should handle INSERT + DELETE in same transaction', async function () {

    const res = await SQLite.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'mix2', 'temp'] },
      { sql: 'DELETE FROM ?? WHERE p_id = ?', params: [TEST_TABLE, 'mix2'] }
    ]);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);

    const count = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'mix2']
    );
    assert.strictEqual(count.value, 0);

  });

  it('should handle plain SQL strings in transaction array', async function () {

    const res = await SQLite.write(instance, [
      'INSERT INTO ' + TEST_TABLE + ' (p_id, col_1) VALUES (\'str1\', \'a\')',
      'INSERT INTO ' + TEST_TABLE + ' (p_id, col_1) VALUES (\'str2\', \'b\')'
    ]);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);

  });

  it('should roll back entire transaction including successful statements', async function () {

    // mix3 does not exist before this test
    const before = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'mix3']
    );
    assert.strictEqual(before.value, 0);

    const res = await SQLite.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'mix3', 'will_rollback'] },
      { sql: 'INSERT INTO non_existent_table (x) VALUES (?)', params: [1] }
    ]);

    assert.strictEqual(res.success, false);

    // mix3 must NOT exist — the INSERT was rolled back
    const after = await SQLite.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'mix3']
    );
    assert.strictEqual(after.value, 0);

  });

});



// ============================================================================
// 13. normalizeParams — runtime type coercion edge cases
// ============================================================================

describe('normalizeParams — coercion via runtime execution', function () {

  it('should handle multiple type coercions in one statement', async function () {

    const now = new Date('2025-01-01T00:00:00.000Z');

    await SQLite.write(
      instance,
      'INSERT INTO ?? (p_id, col_1, col_3, col_4) VALUES (?, ?, ?, ?)',
      [TEST_TABLE, 'coerce_multi', now, null, true]
    );

    const row = await SQLite.getRow(
      instance,
      'SELECT col_1, col_3, col_4 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'coerce_multi']
    );

    assert.strictEqual(row.row.col_1, '2025-01-01T00:00:00.000Z');
    assert.strictEqual(row.row.col_3, null);
    assert.strictEqual(row.row.col_4, 1);

  });

});



// ============================================================================
// 14. close() edge cases
// ============================================================================

describe('close — edge cases', function () {

  it('should be safe to call close() on an already closed instance', async function () {

    const ModuleFactory = require('@superloomdev/js-server-helper-sql-sqlite');
    const temp = ModuleFactory(Lib, { FILE: ':memory:' });

    // Open the handle by running a query
    await temp.getValue(instance, 'SELECT 1 AS x');

    // Close twice — second call must not throw
    await temp.close();
    await temp.close();

  });

  it('should be safe to call close() without ever opening', async function () {

    const ModuleFactory = require('@superloomdev/js-server-helper-sql-sqlite');
    const temp = ModuleFactory(Lib, { FILE: ':memory:' });

    // Never ran a query — handle is null
    await temp.close();

  });

});


});
