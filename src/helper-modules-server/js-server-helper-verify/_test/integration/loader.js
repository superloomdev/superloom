// Info: Integration test loader for js-server-helper-verify.
// Builds five Verify instances, one per supported storage backend
// (Postgres, MySQL, SQLite, MongoDB, DynamoDB). Each instance shares the
// same Lib (Utils, Debug, Crypto, Instance) and the same verify module
// loader call - only the STORE adapter differs.
//
// Pattern: a Lib container is built once, then `verify(Lib, { STORE })` is
// called five times with five different stores. This is exactly the pattern
// the README documents for project use - it just gets exercised here against
// real running databases.
//
// process.env is read ONLY in this file. Test files import { VerifyByBackend }
// and never touch the environment.
'use strict';


const VerifyLoader = require('../../verify');

const buildSqlAdapter = require('./adapters/sql.adapter');
const buildMongoDbAdapter = require('./adapters/mongodb.adapter');
const buildDynamoDbAdapter = require('./adapters/dynamodb.adapter');

const Setup = require('./setup');



/********************************************************************
Build the test environment and return a map of Verify instances keyed
by backend name. The caller is responsible for calling `cleanup()`
when the suite ends to close pools and connections.

@return {Promise<Object>} env
@return {Object} env.Lib - Shared dependency container (Utils, Debug, Crypto, Instance)
@return {Object} env.VerifyByBackend - { postgres, mysql, sqlite, mongodb, dynamodb } -> Verify instances
@return {Object} env.SqlByDialect - { postgres, mysql, sqlite } -> SQL helper instances (for cleanup-helper tests)
@return {Function} env.cleanup - async () -> closes all clients and connections
*********************************************************************/
module.exports = async function loader () {

  // Foundation Lib container - same instance shared across every Verify
  const Lib = {};
  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, { LOG_LEVEL: 'error' });
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
  Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});


  // ============================================================
  // SQL backends - Postgres, MySQL, SQLite share the same adapter
  // ============================================================

  const sqlTable = process.env.VERIFY_TEST_SQL_TABLE || 'verification_codes';

  // Postgres
  const Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
    HOST: process.env.POSTGRES_HOST || 'localhost',
    PORT: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    DATABASE: process.env.POSTGRES_DATABASE || 'test_db',
    USER: process.env.POSTGRES_USER || 'test_user',
    PASSWORD: process.env.POSTGRES_PASSWORD || 'test_pw',
    POOL_MAX: 5
  });

  // MySQL
  const MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, {
    HOST: process.env.MYSQL_HOST || 'localhost',
    PORT: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    DATABASE: process.env.MYSQL_DATABASE || 'test_db',
    USER: process.env.MYSQL_USER || 'test_user',
    PASSWORD: process.env.MYSQL_PASSWORD || 'test_pw',
    POOL_MAX: 5
  });

  // SQLite (in-memory by default - no Docker, no file)
  const SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
    FILE: process.env.SQLITE_FILE || ':memory:'
  });


  // Set up the SQL schema on each backend
  // These run sequentially because each call uses a different pool
  const setupInstance = Lib.Instance.initialize();
  await Setup.setupSql(Postgres, setupInstance, sqlTable);
  await Setup.setupSql(MySQL, setupInstance, sqlTable);
  await Setup.setupSql(SQLite, setupInstance, sqlTable);


  // ============================================================
  // MongoDB backend - uses Lib.MongoDB helper
  // ============================================================

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const mongoDbName = process.env.MONGODB_DATABASE || 'verify_test';
  const mongoCollectionName = process.env.MONGODB_COLLECTION || 'verification_codes';

  Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
    CONNECTION_STRING: mongoUri,
    DATABASE_NAME: mongoDbName,
    SERVER_SELECTION_TIMEOUT: 5000
  });

  // Setup still needs a direct db handle to create the TTL index before tests run
  const { MongoClient } = require('mongodb');
  const mongoSetupClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoSetupClient.connect();
  const mongoDb = mongoSetupClient.db(mongoDbName);
  await Setup.setupMongoDb(mongoDb, mongoCollectionName);
  await mongoSetupClient.close();


  // ============================================================
  // DynamoDB backend - uses Lib helper for the adapter, raw SDK for table setup
  // ============================================================

  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const dynamoTable = process.env.DYNAMODB_TABLE || 'verification_codes';
  const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  const dynamoRegion = process.env.AWS_REGION || 'us-east-1';

  const rawDynamoClient = new DynamoDBClient({
    region: dynamoRegion,
    endpoint: dynamoEndpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
    }
  });

  await Setup.setupDynamoDb(rawDynamoClient, dynamoTable);

  const DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
    REGION: dynamoRegion,
    KEY: process.env.AWS_ACCESS_KEY_ID || 'test',
    SECRET: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    ENDPOINT: dynamoEndpoint
  });


  // ============================================================
  // Domain error catalog (test fixture)
  // ============================================================
  // Stand-in for the application's `[entity].errors.js`. The verify module is
  // pre-configured with this catalog and returns these objects directly on
  // every failure path - the caller can pass them through without inspecting
  // their internal shape. Real applications would inject `Lib.Auth.errors`.
  const TEST_ERRORS = {
    COOLDOWN_ACTIVE:    { code: 'TEST_OTP_COOLDOWN_ACTIVE',    message: 'Please wait before requesting another code.', status: 429 },
    NOT_FOUND:          { code: 'TEST_OTP_NOT_FOUND',          message: 'No active verification code.',                status: 400 },
    EXPIRED:            { code: 'TEST_OTP_EXPIRED',            message: 'This code has expired.',                     status: 400 },
    MAX_FAILS:          { code: 'TEST_OTP_LOCKED',             message: 'Too many failed attempts.',                  status: 429 },
    WRONG_VALUE:        { code: 'TEST_OTP_WRONG_VALUE',        message: 'The code you entered is incorrect.',         status: 400 },
    STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE',    message: 'Service temporarily unavailable.',           status: 503 },
    STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE',    message: 'Service temporarily unavailable.',           status: 503 }
  };


  // ============================================================
  // Build five Verify instances - one per backend
  // ============================================================

  const VerifyByBackend = {

    postgres: VerifyLoader(Lib, {
      STORE: buildSqlAdapter(Postgres, { table: sqlTable, dialect: 'postgres' }),
      ERRORS: TEST_ERRORS
    }),

    mysql: VerifyLoader(Lib, {
      STORE: buildSqlAdapter(MySQL, { table: sqlTable, dialect: 'mysql' }),
      ERRORS: TEST_ERRORS
    }),

    sqlite: VerifyLoader(Lib, {
      STORE: buildSqlAdapter(SQLite, { table: sqlTable, dialect: 'sqlite' }),
      ERRORS: TEST_ERRORS
    }),

    mongodb: VerifyLoader(Lib, {
      STORE: buildMongoDbAdapter(Lib.MongoDB, { collection: mongoCollectionName }),
      ERRORS: TEST_ERRORS
    }),

    dynamodb: VerifyLoader(Lib, {
      STORE: buildDynamoDbAdapter(DynamoDB, { table: dynamoTable }),
      ERRORS: TEST_ERRORS
    })

  };


  // SQL helpers exposed for cleanup-helper tests
  const SqlByDialect = {
    postgres: Postgres,
    mysql: MySQL,
    sqlite: SQLite
  };


  // ============================================================
  // Teardown - close every client / pool / handle the loader opened
  // ============================================================

  const cleanup = async function () {
    try { await Postgres.close(); } catch (e) { /* swallow */ }
    try { await MySQL.close(); } catch (e) { /* swallow */ }
    try { await SQLite.close(); } catch (e) { /* swallow */ }
    try { await Lib.MongoDB.close(); } catch (e) { /* swallow */ }
    try { rawDynamoClient.destroy(); } catch (e) { /* swallow */ }
  };


  return { Lib, VerifyByBackend, SqlByDialect, sqlTable, cleanup };

};
