// Test suite for js-server-helper-aws-s3-url-signer
'use strict';

const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');

const { Lib, Config } = require('./loader.js');
const S3UrlSigner = require('../s3-url-signer.js')(Lib, Config);

describe('S3UrlSigner', { concurrency: false }, function () {

  it('should generate PUT upload URL successfully', async function () {
    const result = await S3UrlSigner.generateUploadUrlPut(
      'test-bucket',
      'test-file.txt',
      'text/plain'
    );

    strictEqual(result.success, true, 'PUT Upload URL generation should succeed');
    strictEqual(typeof result.url, 'string', 'URL should be a string');
    strictEqual(result.url.length > 0, true, 'URL should not be empty');
    strictEqual(result.fields.constructor, Object, 'Fields should be an object');
    strictEqual(result.error, null, 'Error should be null on success');
  });

  it('should generate download URL successfully', async function () {
    const result = await S3UrlSigner.generateDownloadUrlGet(
      'test-bucket',
      'test-file.txt'
    );

    strictEqual(result.success, true, 'Download URL generation should succeed');
    strictEqual(typeof result.url, 'string', 'URL should be a string');
    strictEqual(result.url.length > 0, true, 'URL should not be empty');
    strictEqual(result.error, null, 'Error should be null on success');
  });

  it('should generate POST upload URL successfully', async function () {
    const result = await S3UrlSigner.generateUploadUrlPost(
      'test-bucket',
      'test-file.txt',
      'text/plain'
    );

    strictEqual(result.success, true, 'POST Upload URL generation should succeed');
    strictEqual(typeof result.url, 'string', 'URL should be a string');
    strictEqual(result.url.length > 0, true, 'URL should not be empty');
    strictEqual(result.fields.constructor, Object, 'Fields should be an object');
    strictEqual(result.error, null, 'Error should be null on success');
  });

});
