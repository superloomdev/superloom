// Info: S3 presigned URL generator for direct browser uploads and downloads.
// Server-only: generates signed URLs for secure direct-to-S3 uploads.
'use strict';

// Shared Dependencies (Managed by Loader)
const Lib = {};

// For lazy loading of AWS SDK
let S3Client,
  PutObjectCommand,
  GetObjectCommand,
  getSignedUrl;

// Base configuration (overridden by loader-injected config)
const CONFIG = require('./s3-url-signer.config');


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Load dependencies and configurations

  @param {Object} shared_libs - Reference to libraries already loaded in memory
  @param {Object} config - Custom configuration in key-value pairs

  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config) {

    // Shared Dependencies
    Lib.Utils = shared_libs.Utils;
    Lib.Debug = shared_libs.Debug;

    // Merge loader-injected config (overrides base values)
    if (config && typeof config === 'object') {
      Object.assign(CONFIG, config);
    }

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run Loader
  loader(shared_libs, config);

  // Return Public Functions of this module
  return S3UrlSigner;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const S3UrlSigner = {

  /********************************************************************
  Generate a presigned PUT URL for uploading a file directly to S3.
  Uses HTTP PUT method for simple file uploads. The URL is valid for a limited time (default 15 minutes).

  @param {String} bucket - S3 bucket name
  @param {String} key - Object key (path/filename in S3)
  @param {String} contentType - MIME type of the file to be uploaded
  @param {Object} [options] - (Optional) Additional options
  @param {Integer} [options.expiresIn] - URL expiration time in seconds. Default: 900 (15 min)
  @param {Object} [options.metadata] - Custom metadata to attach to object

  @return {Promise<Object>} - { success, url, fields, error }
  * @return {Boolean} success - true on success
  * @return {String} url - Presigned URL for PUT upload (HTTP PUT method)
  * @return {Object} fields - Empty object for PUT uploads
  * @return {Object|null} error - Error details if failed
  *********************************************************************/
  generateUploadUrlPut: async function (bucket, key, contentType, options) {

    // Initialize AWS SDK client (lazy loading)
    _S3FileUpload.initSDK();

    // Ensure options object exists
    options = options || {};

    try {

      // Create S3 PUT command for presigned URL generation
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType
      });

      // Generate presigned URL with configurable expiry
      const url = await getSignedUrl(_S3FileUpload.client, command, {
        expiresIn: options.expiresIn || CONFIG.UPLOAD_URL_EXPIRY
      });

      Lib.Debug.debug('S3 PUT upload URL generated', { bucket: bucket, key: key });

      // Return successful response with empty fields for PUT uploads
      return {
        success: true,
        url: url,
        fields: {},
        error: null
      };

    }
    catch (error) {

      Lib.Debug.debug('S3 PUT upload URL failed', { bucket: bucket, key: key, error: error.message });

      // Return error response
      return {
        success: false,
        url: null,
        fields: null,
        error: { type: 'URL_ERROR', message: error.message }
      };

    }

  },


  /********************************************************************
  Generate a presigned GET URL for downloading a file directly from S3.
  The URL is valid for a limited time (default 1 hour).

  @param {String} bucket - S3 bucket name
  @param {String} key - Object key (path/filename in S3)
  @param {Object} [options] - (Optional) Additional options
  @param {Integer} [options.expiresIn] - URL expiration time in seconds. Default: 3600 (1 hour)
  @param {String} [options.responseContentDisposition] - Content-Disposition header override

  @return {Promise<Object>} - { success, url, error }
  * @return {Boolean} success - true on success
  * @return {String} url - Presigned URL for GET download
  * @return {Object|null} error - Error details if failed
  *********************************************************************/
  generateDownloadUrlGet: async function (bucket, key, options) {

    // Initialize AWS SDK client (lazy loading)
    _S3FileUpload.initSDK();

    // Ensure options object exists
    options = options || {};

    try {

      // Build S3 GET command parameters
      const commandParams = {
        Bucket: bucket,
        Key: key
      };

      // Add content disposition override if provided
      if (options.responseContentDisposition) {
        commandParams.ResponseContentDisposition = options.responseContentDisposition;
      }

      // Create S3 GET command for presigned URL generation
      const command = new GetObjectCommand(commandParams);

      // Generate presigned URL with configurable expiry
      const url = await getSignedUrl(_S3FileUpload.client, command, {
        expiresIn: options.expiresIn || CONFIG.DOWNLOAD_URL_EXPIRY
      });

      Lib.Debug.debug('S3 download URL generated', { bucket: bucket, key: key });

      // Return successful response
      return {
        success: true,
        url: url,
        error: null
      };

    }
    catch (error) {

      Lib.Debug.debug('S3 download URL failed', { bucket: bucket, key: key, error: error.message });

      // Return error response
      return {
        success: false,
        url: null,
        error: { type: 'URL_ERROR', message: error.message }
      };

    }

  },


  /********************************************************************
  Generate a presigned POST URL for uploading a file directly to S3.
  Uses HTTP POST method with form fields for multipart/form-data uploads.
  The URL is valid for a limited time (default 15 minutes).

  @param {String} bucket - S3 bucket name
  @param {String} key - Object key (path/filename in S3)
  @param {String} contentType - MIME type of the file to be uploaded
  @param {Object} [options] - (Optional) Additional options
  @param {Integer} [options.expiresIn] - URL expiration time in seconds. Default: 900 (15 min)
  @param {Object} [options.metadata] - Custom metadata to attach to object

  @return {Promise<Object>} - { success, url, fields, error }
  * @return {Boolean} success - true on success
  * @return {String} url - Presigned URL for POST upload (HTTP POST method)
  * @return {Object} fields - Form fields for POST upload
  * @return {Object|null} error - Error details if failed
  *********************************************************************/
  generateUploadUrlPost: async function (bucket, key, contentType, options) {

    // Initialize AWS SDK client (lazy loading)
    _S3FileUpload.initSDK();

    // Ensure options object exists
    options = options || {};

    try {

      // Create S3 PUT command for presigned URL generation (same as PUT for POST)
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType
      });

      // Generate presigned URL with configurable expiry
      const url = await getSignedUrl(_S3FileUpload.client, command, {
        expiresIn: options.expiresIn || CONFIG.UPLOAD_URL_EXPIRY
      });

      Lib.Debug.debug('S3 POST upload URL generated', { bucket: bucket, key: key });

      // Return successful response with form fields for POST uploads
      return {
        success: true,
        url: url,
        fields: {
          key: key,
          'Content-Type': contentType
        },
        error: null
      };

    }
    catch (error) {

      Lib.Debug.debug('S3 POST upload URL failed', { bucket: bucket, key: key, error: error.message });

      // Return error response
      return {
        success: false,
        url: null,
        fields: null,
        error: { type: 'URL_ERROR', message: error.message }
      };

    }

  }

};///////////////////////////Public Functions END//////////////////////////////



//////////////////////////Private Functions START//////////////////////////////
const _S3FileUpload = {

  client: null,


  /********************************************************************
  Lazy-load AWS SDK v3 S3 client and presigner.

  @return {void}
  *********************************************************************/
  initSDK: function () {

    if (_S3FileUpload.client !== null) return;

    const { S3Client: S3ClientClass, PutObjectCommand: PutCmd, GetObjectCommand: GetCmd } = require('@aws-sdk/client-s3');
    const { getSignedUrl: getSigned } = require('@aws-sdk/s3-request-presigner');

    S3Client = S3ClientClass;
    PutObjectCommand = PutCmd;
    GetObjectCommand = GetCmd;
    getSignedUrl = getSigned;

    const clientConfig = { region: CONFIG.REGION };

    // Add credentials if provided
    if (CONFIG.KEY && CONFIG.SECRET) {
      clientConfig.credentials = {
        accessKeyId: CONFIG.KEY,
        secretAccessKey: CONFIG.SECRET
      };
    }

    // Add custom endpoint if provided (for MinIO/LocalStack)
    if (CONFIG.ENDPOINT) {
      clientConfig.endpoint = CONFIG.ENDPOINT;
      clientConfig.forcePathStyle = CONFIG.FORCE_PATH_STYLE || false;
    }

    _S3FileUpload.client = new S3Client(clientConfig);

  }

};//////////////////////////Private Functions END//////////////////////////////
