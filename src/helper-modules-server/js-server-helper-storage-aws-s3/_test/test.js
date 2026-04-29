// Tests for js-server-helper-aws-s3
// Works with both emulated (MinIO) and integration (real AWS) testing
// Config comes from environment variables via loader.js
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} = require('@aws-sdk/client-s3');

// Load all dependencies and config via test loader (mirrors main project loader pattern)
// process.env is NEVER accessed in test files — only in loader.js
const { Lib, Config } = require('./loader')();
const S3 = Lib.S3;
const Instance = Lib.Instance;

// Create a test instance (simulates a real request lifecycle)
const instance = Instance.initialize();

// Test infrastructure: raw AWS SDK client for bucket setup/teardown
// Not part of the module under test — only used in before/after hooks
// Uses same credentials as the S3 module (both connect to the same target)
const admin_options = {
  region: Config.s3_region,
  credentials: {
    accessKeyId: Config.s3_access_key,
    secretAccessKey: Config.s3_secret_key
  }
};

// Endpoint and path-style are only set for emulated testing (MinIO)
// For integration testing these are undefined/false — SDK uses real AWS
if (Config.s3_endpoint) {
  admin_options.endpoint = Config.s3_endpoint;
}

if (Config.s3_force_path_style === true) {
  admin_options.forcePathStyle = true;
}

const AdminClient = new S3Client(admin_options);

// Test bucket names (prefixed with test- — IAM policy restricts to these)
// Unique suffix to avoid conflicts between parallel test runs
const SUFFIX = Date.now().toString(36);
const TEST_BUCKET = 'test-crud-' + SUFFIX;
const TEST_BUCKET_COPY = 'test-copy-' + SUFFIX;


/********************************************************************
Empty a bucket by listing and deleting all objects. Used only by the
teardown hook — buckets must be empty before they can be deleted.

@param {String} bucket - Bucket name to empty
@return {Promise<void>}
*********************************************************************/
async function emptyBucket (bucket) {

  // Loop to handle more than 1000 objects across pages
  let continuation_token;

  do {

    // List current page of objects
    const list_params = { Bucket: bucket };
    if (continuation_token) {
      list_params.ContinuationToken = continuation_token;
    }

    const list_response = await AdminClient.send(new ListObjectsV2Command(list_params));

    // Delete listed objects if any
    if (list_response.Contents && list_response.Contents.length > 0) {

      await AdminClient.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: list_response.Contents.map(function (o) { return { Key: o.Key }; }),
          Quiet: true
        }
      }));

    }

    // Continue while S3 reports more pages
    continuation_token = list_response.IsTruncated ? list_response.NextContinuationToken : null;

  }
  while (continuation_token);

}



describe('S3', { concurrency: false }, function () {


// ============================================================================
// 0. BUCKET SETUP / TEARDOWN
// ============================================================================

before(async function () {

  // Create CRUD test bucket
  try {
    await AdminClient.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
  }
  catch (err) {
    if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
      throw err;
    }
  }

  // Create copy destination bucket
  try {
    await AdminClient.send(new CreateBucketCommand({ Bucket: TEST_BUCKET_COPY }));
  }
  catch (err) {
    if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
      throw err;
    }
  }

});


after(async function () {

  // Empty then delete each test bucket (buckets must be empty before deletion)
  for (const bucket of [TEST_BUCKET, TEST_BUCKET_COPY]) {
    try {
      await emptyBucket(bucket);
      await AdminClient.send(new DeleteBucketCommand({ Bucket: bucket }));
    }
    catch (_err) {
      // Ignore teardown errors — re-running tests should still succeed
    }
  }

});



// ============================================================================
// 1. UPLOAD FILE
// ============================================================================

describe('uploadFile', function () {

  it('should return success when uploading a small string body', async function () {

    const result = await S3.uploadFile(instance, TEST_BUCKET, 'docs/hello.txt', 'Hello world', 'text/plain');

    assert.strictEqual(result.success, true);
    assert.ok(result.etag, 'etag should be present');
    assert.strictEqual(result.error, null);

  });


  it('should overwrite an existing object with same key', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'docs/overwrite.txt', 'original', 'text/plain');
    const result = await S3.uploadFile(instance, TEST_BUCKET, 'docs/overwrite.txt', 'updated', 'text/plain');

    assert.strictEqual(result.success, true);

    // Verify overwrite persisted
    const get_result = await S3.getFile(instance, TEST_BUCKET, 'docs/overwrite.txt', true);
    assert.strictEqual(get_result.body, 'updated');

  });


  it('should attach user metadata when provided', async function () {

    const metadata = { owner: 'alice', source: 'unit-test' };
    const upload = await S3.uploadFile(instance, TEST_BUCKET, 'docs/with-meta.txt', 'meta body', 'text/plain', metadata);
    assert.strictEqual(upload.success, true);

    // Verify metadata round-trips on read
    const get_result = await S3.getFile(instance, TEST_BUCKET, 'docs/with-meta.txt', true);
    assert.strictEqual(get_result.metadata.owner, 'alice');
    assert.strictEqual(get_result.metadata.source, 'unit-test');

  });

});



// ============================================================================
// 2. GET FILE
// ============================================================================

describe('getFile', function () {

  it('should return body as Buffer by default', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'bin/data.bin', Buffer.from([1, 2, 3, 4, 5]), 'application/octet-stream');

    const result = await S3.getFile(instance, TEST_BUCKET, 'bin/data.bin');

    assert.strictEqual(result.success, true);
    assert.ok(Buffer.isBuffer(result.body), 'body should be a Buffer');
    assert.deepStrictEqual(Array.from(result.body), [1, 2, 3, 4, 5]);
    assert.strictEqual(result.error, null);

  });


  it('should return body as string when output_as_string is true', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'txt/greeting.txt', 'hi there', 'text/plain');

    const result = await S3.getFile(instance, TEST_BUCKET, 'txt/greeting.txt', true);

    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.body, 'string');
    assert.strictEqual(result.body, 'hi there');
    assert.strictEqual(result.content_type, 'text/plain');

  });


  it('should return error type NOT_FOUND when key does not exist', async function () {

    const result = await S3.getFile(instance, TEST_BUCKET, 'does-not-exist.txt');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.body, null);
    assert.strictEqual(result.error.type, 'NOT_FOUND');

  });

});



// ============================================================================
// 3. LIST OBJECTS
// ============================================================================

describe('listObjects', function () {

  it('should return keys for all objects in a bucket', async function () {

    // Seed known keys (some earlier tests seed additional keys too)
    await S3.uploadFile(instance, TEST_BUCKET, 'list/a.txt', 'a', 'text/plain');
    await S3.uploadFile(instance, TEST_BUCKET, 'list/b.txt', 'b', 'text/plain');

    const result = await S3.listObjects(instance, TEST_BUCKET);

    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.keys));
    assert.ok(result.keys.includes('list/a.txt'));
    assert.ok(result.keys.includes('list/b.txt'));
    assert.strictEqual(result.error, null);

  });


  it('should filter keys by prefix', async function () {

    const result = await S3.listObjects(instance, TEST_BUCKET, 'list/');

    assert.strictEqual(result.success, true);
    assert.ok(result.keys.length >= 2);
    result.keys.forEach(function (k) {
      assert.ok(k.startsWith('list/'), 'key ' + k + ' should start with prefix');
    });

  });


  it('should return empty array when prefix matches nothing', async function () {

    const result = await S3.listObjects(instance, TEST_BUCKET, 'no-such-prefix-xyz/');

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.keys, []);

  });

});



// ============================================================================
// 4. UPLOAD FILES (parallel)
// ============================================================================

describe('uploadFiles', function () {

  it('should upload multiple files in parallel and report per-file outcomes', async function () {

    const files = [
      { bucket: TEST_BUCKET, key: 'batch/one.txt', body: 'one', content_type: 'text/plain' },
      { bucket: TEST_BUCKET, key: 'batch/two.txt', body: 'two', content_type: 'text/plain' },
      { bucket: TEST_BUCKET, key: 'batch/three.txt', body: 'three', content_type: 'text/plain' }
    ];

    const result = await S3.uploadFiles(instance, files);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results.length, 3);
    assert.strictEqual(result.error, null);
    result.results.forEach(function (r) {
      assert.strictEqual(r.success, true);
    });

    // Verify all three objects exist
    for (const f of files) {
      const get_result = await S3.getFile(instance, f.bucket, f.key, true);
      assert.strictEqual(get_result.body, f.body);
    }

  });

});



// ============================================================================
// 5. DELETE FILE
// ============================================================================

describe('deleteFile', function () {

  it('should return success when deleting an existing object', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'del/target.txt', 'delete me', 'text/plain');

    const result = await S3.deleteFile(instance, TEST_BUCKET, 'del/target.txt');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);

    // Verify deletion
    const get_result = await S3.getFile(instance, TEST_BUCKET, 'del/target.txt');
    assert.strictEqual(get_result.success, false);
    assert.strictEqual(get_result.error.type, 'NOT_FOUND');

  });


  it('should return success when deleting a non-existent key (idempotent)', async function () {

    const result = await S3.deleteFile(instance, TEST_BUCKET, 'never-existed.txt');

    assert.strictEqual(result.success, true);

  });

});



// ============================================================================
// 6. DELETE FILES
// ============================================================================

describe('deleteFiles', function () {

  it('should delete multiple keys in a single request', async function () {

    // Seed three keys
    await S3.uploadFile(instance, TEST_BUCKET, 'bulk/1.txt', '1', 'text/plain');
    await S3.uploadFile(instance, TEST_BUCKET, 'bulk/2.txt', '2', 'text/plain');
    await S3.uploadFile(instance, TEST_BUCKET, 'bulk/3.txt', '3', 'text/plain');

    const result = await S3.deleteFiles(instance, TEST_BUCKET, ['bulk/1.txt', 'bulk/2.txt', 'bulk/3.txt']);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deleted.length, 3);
    assert.strictEqual(result.error, null);

    // Verify deletion
    const list_result = await S3.listObjects(instance, TEST_BUCKET, 'bulk/');
    assert.strictEqual(list_result.keys.length, 0);

  });


  it('should be a no-op for an empty key list', async function () {

    const result = await S3.deleteFiles(instance, TEST_BUCKET, []);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.deleted, []);

  });

});



// ============================================================================
// 7. COPY FILE
// ============================================================================

describe('copyFile', function () {

  it('should copy an object within the same bucket', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'copy/source.txt', 'source data', 'text/plain');

    const result = await S3.copyFile(instance, TEST_BUCKET, 'copy/source.txt', TEST_BUCKET, 'copy/dest.txt');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);

    // Both source and dest exist and match
    const source = await S3.getFile(instance, TEST_BUCKET, 'copy/source.txt', true);
    const dest = await S3.getFile(instance, TEST_BUCKET, 'copy/dest.txt', true);
    assert.strictEqual(source.body, 'source data');
    assert.strictEqual(dest.body, 'source data');

  });


  it('should copy an object across buckets', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'xbucket/source.txt', 'across', 'text/plain');

    const result = await S3.copyFile(instance, TEST_BUCKET, 'xbucket/source.txt', TEST_BUCKET_COPY, 'xbucket/dest.txt');

    assert.strictEqual(result.success, true);

    // Destination bucket should have the file
    const dest = await S3.getFile(instance, TEST_BUCKET_COPY, 'xbucket/dest.txt', true);
    assert.strictEqual(dest.body, 'across');

  });

});



// ============================================================================
// 8. MOVE FILE
// ============================================================================

describe('moveFile', function () {

  it('should copy to destination and delete source', async function () {

    await S3.uploadFile(instance, TEST_BUCKET, 'move/source.txt', 'move me', 'text/plain');

    const result = await S3.moveFile(instance, TEST_BUCKET, 'move/source.txt', TEST_BUCKET, 'move/dest.txt');

    assert.strictEqual(result.success, true);

    // Destination exists with source content
    const dest = await S3.getFile(instance, TEST_BUCKET, 'move/dest.txt', true);
    assert.strictEqual(dest.body, 'move me');

    // Source is gone
    const source_check = await S3.getFile(instance, TEST_BUCKET, 'move/source.txt');
    assert.strictEqual(source_check.success, false);
    assert.strictEqual(source_check.error.type, 'NOT_FOUND');

  });

});



// ============================================================================
// 9. COMMAND BUILDERS
// ============================================================================

describe('commandBuilderForUploadObject', function () {

  it('should return service params with Bucket, Key, Body, and default ContentType', function () {

    const params = S3.commandBuilderForUploadObject('my-bucket', 'file.txt', 'content');

    assert.strictEqual(params.Bucket, 'my-bucket');
    assert.strictEqual(params.Key, 'file.txt');
    assert.strictEqual(params.Body, 'content');
    assert.strictEqual(params.ContentType, 'application/octet-stream');

  });


  it('should attach Metadata when provided', function () {

    const params = S3.commandBuilderForUploadObject('my-bucket', 'file.txt', 'x', 'text/plain', { foo: 'bar' });

    assert.deepStrictEqual(params.Metadata, { foo: 'bar' });

  });


  it('should attach ACL public-read when is_public is true', function () {

    const params = S3.commandBuilderForUploadObject('my-bucket', 'file.txt', 'x', 'text/plain', null, true);

    assert.strictEqual(params.ACL, 'public-read');

  });


  it('should attach ACL private when is_public is false', function () {

    const params = S3.commandBuilderForUploadObject('my-bucket', 'file.txt', 'x', 'text/plain', null, false);

    assert.strictEqual(params.ACL, 'private');

  });


  it('should omit ACL when is_public is null/undefined', function () {

    const params = S3.commandBuilderForUploadObject('my-bucket', 'file.txt', 'x');

    assert.strictEqual(params.ACL, undefined);

  });

});


describe('commandBuilderForGetObject', function () {

  it('should return service params with Bucket and Key only', function () {

    const params = S3.commandBuilderForGetObject('my-bucket', 'file.txt');

    assert.deepStrictEqual(params, { Bucket: 'my-bucket', Key: 'file.txt' });

  });

});


describe('commandBuilderForDeleteObject', function () {

  it('should return service params with Bucket and Key only', function () {

    const params = S3.commandBuilderForDeleteObject('my-bucket', 'file.txt');

    assert.deepStrictEqual(params, { Bucket: 'my-bucket', Key: 'file.txt' });

  });

});


describe('commandBuilderForCopyObject', function () {

  it('should return service params with encoded CopySource', function () {

    const params = S3.commandBuilderForCopyObject('src-bucket', 'a/b c.txt', 'dest-bucket', 'x/y.txt');

    assert.strictEqual(params.Bucket, 'dest-bucket');
    assert.strictEqual(params.Key, 'x/y.txt');
    assert.strictEqual(params.CopySource, encodeURIComponent('src-bucket/a/b c.txt'));

  });


  it('should attach ACL when is_public is provided', function () {

    const params_public = S3.commandBuilderForCopyObject('s', 'k', 'd', 'k2', true);
    const params_private = S3.commandBuilderForCopyObject('s', 'k', 'd', 'k2', false);

    assert.strictEqual(params_public.ACL, 'public-read');
    assert.strictEqual(params_private.ACL, 'private');

  });

});


});
