// Info: Tests for js-server-helper-mysql.
// Runs against both emulated (Docker MySQL 8) and integration (real database) targets.
// Configuration comes entirely from environment variables via loader.js.
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const MySQL2Promise = require('mysql2/promise');

// Load dependencies via test loader — process.env is touched only there.
const { Lib, Config } = require('./loader')();
const MySQL = Lib.MySQL;
const Instance = Lib.Instance;

// Single test instance — represents a "request" for performance timeline.
const instance = Instance.initialize();

// Admin connection for schema setup/teardown. Not part of the module under test.
const ADMIN_OPTIONS = {
  host: Config.mysql_host,
  port: Config.mysql_port,
  user: Config.mysql_user,
  password: Config.mysql_password,
  database: Config.mysql_database,
  multipleStatements: true
};

// Test table name — keep simple and unique
const TEST_TABLE = 'test_table';



describe('MySQL', { concurrency: false }, function () {


// ============================================================================
// 0. TABLE SETUP / TEARDOWN
// ============================================================================

before(async function () {

  const admin = await MySQL2Promise.createConnection(ADMIN_OPTIONS);

  await admin.query('DROP TABLE IF EXISTS ' + TEST_TABLE);

  await admin.query(
    'CREATE TABLE ' + TEST_TABLE + ' (' +
    '  id INT NOT NULL AUTO_INCREMENT,' +
    '  p_id VARCHAR(20) NOT NULL,' +
    '  col_1 VARCHAR(200) NULL,' +
    '  col_2 CHAR(3) CHARACTER SET ascii NULL,' +
    '  col_3 INT NULL,' +
    '  col_4 BOOLEAN DEFAULT 1,' +
    '  PRIMARY KEY (id),' +
    '  UNIQUE KEY uk_p_id (p_id)' +
    ') ENGINE = InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_general_ci'
  );

  await admin.end();

});


after(async function () {

  // Drop table and close the module's pool
  const admin = await MySQL2Promise.createConnection(ADMIN_OPTIONS);
  await admin.query('DROP TABLE IF EXISTS ' + TEST_TABLE);
  await admin.end();

  await MySQL.close();

});



// ============================================================================
// 1. buildQuery / buildRawText / buildMultiCondition — pure, no I/O
// ============================================================================

describe('buildQuery', function () {

  it('should substitute ? placeholders with escaped values', function () {

    const sql = MySQL.buildQuery('SELECT * FROM ?? WHERE ?? = ?', [TEST_TABLE, 'id', 42]);

    assert.strictEqual(
      sql,
      'SELECT * FROM `' + TEST_TABLE + '` WHERE `id` = 42'
    );

  });

  it('should escape string values safely', function () {

    const sql = MySQL.buildQuery('SELECT ? AS x', [`Hello " World ' Test`]);

    assert.match(sql, /^SELECT '.+' AS x$/);
    assert.ok(sql.indexOf('\\') !== -1 || sql.indexOf('\'\'') !== -1 || sql.includes('\\\''));

  });

  it('should serialize an object via SET ?', function () {

    const sql = MySQL.buildQuery('INSERT INTO test SET ?', { id: 1, name: 'Alice' });

    assert.strictEqual(sql, "INSERT INTO test SET `id` = 1, `name` = 'Alice'");

  });

});


describe('buildRawText', function () {

  it('should embed a raw fragment without escaping', function () {

    const raw = MySQL.buildRawText('NOW()');
    const sql = MySQL.buildQuery('INSERT INTO test SET ?', { created_at: raw });

    assert.strictEqual(sql, 'INSERT INTO test SET `created_at` = NOW()');

  });

  it('should embed spatial SQL unescaped', function () {

    const point = MySQL.buildRawText("ST_GeomFromText('POINT(28.61 77.20)', 4326)");
    const sql = MySQL.buildQuery('INSERT INTO address SET ?', { point: point });

    assert.strictEqual(
      sql,
      "INSERT INTO address SET `point` = ST_GeomFromText('POINT(28.61 77.20)', 4326)"
    );

  });

});


describe('buildMultiCondition', function () {

  it('should default to AND', function () {

    const cond = MySQL.buildMultiCondition({ id: 1, name: 'Alice' });

    assert.strictEqual(cond, " `id` = 1  AND  `name` = 'Alice' ");

  });

  it('should join with OR when specified', function () {

    const cond = MySQL.buildMultiCondition({ a: 1, b: 2 }, 'OR');

    assert.strictEqual(cond, " `a` = 1  OR  `b` = 2 ");

  });

});



// ============================================================================
// 2. write (single statement) + getRow / getRows / getValue
// ============================================================================

describe('write (single statement)', function () {

  it('should INSERT a row and return affected_rows and insert_id', async function () {

    const res = await MySQL.write(
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

    const res = await MySQL.write(
      instance,
      'UPDATE ?? SET col_3 = ? WHERE p_id = ?',
      [TEST_TABLE, 999, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 1);

  });

  it('should return error on malformed SQL', async function () {

    const res = await MySQL.write(instance, 'INSERT INTO does_not_exist VALUES (?)', [1]);

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.type, 'QUERY_ERROR');
    assert.ok(res.error.message.length > 0);

  });

});


describe('getRow', function () {

  it('should return the first row', async function () {

    const res = await MySQL.getRow(
      instance,
      'SELECT p_id, col_1, col_3 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.row, { p_id: 'row1', col_1: 'hello', col_3: 999 });

  });

  it('should return null when no row matches', async function () {

    const res = await MySQL.getRow(
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
    await MySQL.write(
      instance,
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'row2', 'second']
    );

    const res = await MySQL.getRows(
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

    const res = await MySQL.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? ',
      [TEST_TABLE]
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.value, 2);

  });

  it('should return null when no row matches', async function () {

    const res = await MySQL.getValue(
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

    const res = await MySQL.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx1', 'a'] },
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx2', 'b'] }
    ]);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);

    const count = await MySQL.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id IN (?, ?)',
      [TEST_TABLE, 'tx1', 'tx2']
    );
    assert.strictEqual(count.value, 2);

  });

  it('should roll back all statements when any fails', async function () {

    const res = await MySQL.write(instance, [
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx3', 'a'] },
      { sql: 'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', params: [TEST_TABLE, 'tx1', 'dup'] }
      // duplicate unique key — transaction must roll back
    ]);

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.type, 'TRANSACTION_ERROR');

    const count = await MySQL.getValue(
      instance,
      'SELECT COUNT(*) FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'tx3']
    );
    assert.strictEqual(count.value, 0);

  });

});


describe('getClient / releaseClient', function () {

  it('should acquire and release a pool connection', async function () {

    const res = await MySQL.getClient(instance);

    assert.strictEqual(res.success, true);
    assert.ok(res.client);
    assert.strictEqual(typeof res.client.query, 'function');

    const [rows] = await res.client.query('SELECT 1 AS one');
    assert.strictEqual(rows[0].one, 1);

    MySQL.releaseClient(res.client);

  });

});



// ============================================================================
// 4. Auto-shaping helper: get + write polymorphic input
// ============================================================================

describe('get', function () {

  it('should return null when no row matches', async function () {

    const res = await MySQL.get(
      instance,
      'SELECT * FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'nope']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result, null);
    assert.strictEqual(res.has_multiple_rows, false);

  });

  it('should return a scalar when single column single row', async function () {

    const res = await MySQL.get(
      instance,
      'SELECT col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result, 'hello');
    assert.strictEqual(res.has_multiple_rows, false);

  });

  it('should return a row object when single multi-column row', async function () {

    const res = await MySQL.get(
      instance,
      'SELECT p_id, col_1 FROM ?? WHERE p_id = ?',
      [TEST_TABLE, 'row1']
    );

    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.result, { p_id: 'row1', col_1: 'hello' });
    assert.strictEqual(res.has_multiple_rows, false);

  });

  it('should return array with has_multiple_rows=true for many', async function () {

    const res = await MySQL.get(
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

    const res = await MySQL.write(instance, []);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 0);

  });

  it('should execute single pre-built SQL string', async function () {

    const sql = MySQL.buildQuery(
      'INSERT INTO ?? (p_id, col_1) VALUES (?, ?)',
      [TEST_TABLE, 'lg1', 'legacy']
    );

    const res = await MySQL.write(instance, sql);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 1);
    assert.ok(res.insert_id > 0);

  });

  it('should execute array of pre-built SQL strings transactionally', async function () {

    const sql = [
      MySQL.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg2', 'a']),
      MySQL.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg3', 'b'])
    ];

    const res = await MySQL.write(instance, sql);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.affected_rows, 2);

  });

  it('should roll back array when any statement fails', async function () {

    const sql = [
      MySQL.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg4', 'a']),
      MySQL.buildQuery('INSERT INTO ?? (p_id, col_1) VALUES (?, ?)', [TEST_TABLE, 'lg1', 'dup'])
    ];

    const res = await MySQL.write(instance, sql);

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.type, 'TRANSACTION_ERROR');

    const count = await MySQL.getValue(
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

  it('should allow independent pools via multiple loader calls', async function () {

    const ModuleFactory = require('@superloomdev/js-server-helper-sql-mysql');

    // Two instances pointing at the same DB with different pool sizes
    const A = ModuleFactory(Lib, {
      HOST: Config.mysql_host,
      PORT: Config.mysql_port,
      DATABASE: Config.mysql_database,
      USER: Config.mysql_user,
      PASSWORD: Config.mysql_password,
      POOL_MAX: 2
    });
    const B = ModuleFactory(Lib, {
      HOST: Config.mysql_host,
      PORT: Config.mysql_port,
      DATABASE: Config.mysql_database,
      USER: Config.mysql_user,
      PASSWORD: Config.mysql_password,
      POOL_MAX: 3
    });

    const ra = await A.getValue(instance, 'SELECT 1 AS x');
    const rb = await B.getValue(instance, 'SELECT 2 AS x');

    assert.strictEqual(ra.value, 1);
    assert.strictEqual(rb.value, 2);

    // Each instance has its own close()
    await A.close();
    await B.close();

  });

});


});
