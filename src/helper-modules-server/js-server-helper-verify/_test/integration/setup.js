// Info: Per-backend schema setup for the verify integration tests.
// Each function creates the verification_codes table / collection / DynamoDB
// table, configures the native TTL where supported, and is idempotent
// (safe to call repeatedly).
'use strict';



/********************************************************************
Set up the SQL schema. Works for Postgres, MySQL, and SQLite because
the schema syntax is the intersection of all three.

Column names are deliberately readable (not abbreviated) - storage cost
is negligible on a verify table and readability beats byte-counting here.
None of the column names are reserved words on any of the three engines.

@param {Object} Sql - Loaded SQL helper instance (Postgres, MySQL, or SQLite)
@param {Object} instance - Request instance for performance tracing
@param {String} table - Table name

@return {Promise<void>}
*********************************************************************/
async function setupSql (Sql, instance, table) {

  // Drop and recreate so each test run starts clean - integration suites assume a blank table
  await Sql.write(instance, 'DROP TABLE IF EXISTS ' + table, []);

  // BIGINT works on Postgres / MySQL; SQLite treats it as INTEGER (64-bit affinity)
  // VARCHAR(255) is accepted everywhere; SQLite ignores the length limit
  const createTableSql = (
    'CREATE TABLE ' + table + ' (' +
    '  scope        VARCHAR(255) NOT NULL,' +
    '  id           VARCHAR(255) NOT NULL,' +
    '  code         VARCHAR(255) NOT NULL,' +
    '  fail_count   INTEGER      NOT NULL DEFAULT 0,' +
    '  created_at   BIGINT       NOT NULL,' +
    '  expires_at   BIGINT       NOT NULL,' +
    '  PRIMARY KEY (scope, id)' +
    ')'
  );
  await Sql.write(instance, createTableSql, []);

  // Index on expires_at for cleanup queries (DELETE WHERE expires_at < <now>)
  await Sql.write(
    instance,
    'CREATE INDEX ' + table + '_expires_at_idx ON ' + table + ' (expires_at)',
    []
  );

}



/********************************************************************
Set up the MongoDB collection and indexes (compound _id + native TTL).

@param {Object} db - Connected MongoDB Db handle (from raw mongodb driver)
@param {String} collectionName - Collection name

@return {Promise<Object>} - The Collection handle, ready for the adapter
*********************************************************************/
async function setupMongoDb (db, collectionName) {

  // Drop and recreate so each test run starts clean
  const existing = await db.listCollections({ name: collectionName }).toArray();
  if (existing.length > 0) {
    await db.collection(collectionName).drop();
  }

  await db.createCollection(collectionName);
  const collection = db.collection(collectionName);

  // Native TTL index - MongoDB sweeps every ~60 seconds. The Date in `_ttl`
  // determines exactly when (expireAfterSeconds: 0 means "expire at the Date").
  // Leading underscore on `_ttl` signals it is a storage-layer mechanism,
  // not part of the verify module's record contract.
  await collection.createIndex(
    { _ttl: 1 },
    { expireAfterSeconds: 0, name: 'verify_ttl_idx' }
  );

  return collection;

}



/********************************************************************
Set up the DynamoDB table and enable TTL on the `expires_at` attribute.

Uses the raw AWS SDK because the framework's DynamoDB helper does not
expose CreateTable / UpdateTimeToLive (those are operational, not
data-plane). This setup is one-shot per environment.

@param {Object} dynamoClient - Raw @aws-sdk/client-dynamodb DynamoDBClient instance
@param {String} table - DynamoDB table name

@return {Promise<void>}
*********************************************************************/
async function setupDynamoDb (dynamoClient, table) {

  const {
    CreateTableCommand,
    DeleteTableCommand,
    DescribeTableCommand,
    UpdateTimeToLiveCommand
  } = require('@aws-sdk/client-dynamodb');

  // Drop the table if it exists so each test run starts clean
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: table }));
    await dynamoClient.send(new DeleteTableCommand({ TableName: table }));
    await _waitTableGone(dynamoClient, table);
  } catch (err) {
    // ResourceNotFoundException is fine - table just didn't exist
    if (err.name !== 'ResourceNotFoundException') {
      throw err;
    }
  }

  // Create the table with the composite key schema
  await dynamoClient.send(new CreateTableCommand({
    TableName: table,
    KeySchema: [
      { AttributeName: 'scope', KeyType: 'HASH' },
      { AttributeName: 'id', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'scope', AttributeType: 'S' },
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }));

  await _waitTableActive(dynamoClient, table);

  // Enable TTL on the `expires_at` attribute - AWS sweeps within 48 hours of expiry.
  // DynamoDB Local supports the API call but does not actually enforce TTL, so
  // tests assert on `expires_at < now()` semantics, not on AWS-side cleanup.
  try {
    await dynamoClient.send(new UpdateTimeToLiveCommand({
      TableName: table,
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: 'expires_at'
      }
    }));
  } catch (err) {
    // DynamoDB Local accepts the call; some emulators reject it - non-fatal for tests
    if (!/UnknownOperationException|UnsupportedOperationException/.test(err.name || '')) {
      throw err;
    }
  }

}



/********************************************************************
Wait until DescribeTable reports ACTIVE. DynamoDB Local is fast (~50ms)
but real AWS can take seconds.
*********************************************************************/
async function _waitTableActive (dynamoClient, table) {

  const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    const r = await dynamoClient.send(new DescribeTableCommand({ TableName: table }));
    if (r.Table && r.Table.TableStatus === 'ACTIVE') {
      return;
    }
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }

  throw new Error('Timed out waiting for DynamoDB table ' + table + ' to become ACTIVE');

}



/********************************************************************
Wait until DescribeTable returns ResourceNotFoundException.
*********************************************************************/
async function _waitTableGone (dynamoClient, table) {

  const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {

    try {
      await dynamoClient.send(new DescribeTableCommand({ TableName: table }));
    } catch (err) {
      if (err.name === 'ResourceNotFoundException') {
        return;
      }
      throw err;
    }

    await new Promise(function (resolve) { setTimeout(resolve, 100); });

  }

  throw new Error('Timed out waiting for DynamoDB table ' + table + ' to be deleted');

}



module.exports = {
  setupSql: setupSql,
  setupMongoDb: setupMongoDb,
  setupDynamoDb: setupDynamoDb
};
