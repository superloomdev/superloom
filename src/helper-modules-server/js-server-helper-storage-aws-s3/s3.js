// Info: AWS S3 wrapper for cloud file storage. List, upload, download, delete, copy, move.
// Server-only: uses AWS SDK v3 S3 client with explicit credential injection.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent S3 interface
// with its own Lib, CONFIG, and per-instance S3Client.
//
// Lazy-loaded AWS SDK v3 adapter (stateless, shared across instances):
//   - '@aws-sdk/client-s3' -> S3Client class and command constructors
//
// Local emulation: set CONFIG.ENDPOINT to a MinIO/S3-compatible server and
// CONFIG.FORCE_PATH_STYLE to true. Real AWS leaves ENDPOINT undefined and
// FORCE_PATH_STYLE false.
'use strict';

// Shared stateless SDK adapter (module-level - require() is cached anyway).
let S3Lib = null;



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib, CONFIG, and S3 client.

@param {Object} shared_libs - Lib container with Utils, Debug, Instance
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Instance: shared_libs.Instance
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./s3.config'),
    config || {}
  );

  // Mutable per-instance state (S3Client lives here)
  const state = {
    client: null
  };

  // Create and return the public interface
  return createInterface(Lib, CONFIG, state);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and state.

@param {Object} Lib - Dependency container (Utils, Debug, Instance)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} state - Mutable state holder (S3Client reference)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const S3 = {

    // ~~~~~~~~~~~~~~~~~~~~ Builders ~~~~~~~~~~~~~~~~~~~~
    // Pure functions that build service params without I/O.

    /********************************************************************
    Build service params for a PutObject command.

    @param {String} bucket - S3 bucket name
    @param {String} key - Object key (full path including filename)
    @param {Buffer|Uint8Array|Blob|string|Readable} body - File content
    @param {String} [content_type] - MIME type (default 'application/octet-stream')
    @param {Object} [metadata] - Custom user metadata (stored as x-amz-meta-*)
    @param {Boolean} [is_public] - If true sets ACL 'public-read', if false 'private', if null leaves ACL unset

    @return {Object} - Service params for PutObjectCommand
    *********************************************************************/
    commandBuilderForUploadObject: function (bucket, key, body, content_type, metadata, is_public) {

      // Base params with default content type
      const service_params = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: content_type || 'application/octet-stream'
      };

      // Attach optional custom metadata map
      if (!Lib.Utils.isEmpty(metadata)) {
        service_params.Metadata = metadata;
      }

      // Attach optional canned ACL only when explicitly provided
      if (is_public === true) {
        service_params.ACL = 'public-read';
      }
      else if (is_public === false) {
        service_params.ACL = 'private';
      }

      return service_params;

    },


    /********************************************************************
    Build service params for a GetObject command.

    @param {String} bucket - S3 bucket name
    @param {String} key - Object key

    @return {Object} - Service params for GetObjectCommand
    *********************************************************************/
    commandBuilderForGetObject: function (bucket, key) {

      return {
        Bucket: bucket,
        Key: key
      };

    },


    /********************************************************************
    Build service params for a DeleteObject command.

    @param {String} bucket - S3 bucket name
    @param {String} key - Object key

    @return {Object} - Service params for DeleteObjectCommand
    *********************************************************************/
    commandBuilderForDeleteObject: function (bucket, key) {

      return {
        Bucket: bucket,
        Key: key
      };

    },


    /********************************************************************
    Build service params for a CopyObject command.

    @param {String} source_bucket - Source bucket name
    @param {String} source_key - Source object key
    @param {String} dest_bucket - Destination bucket name
    @param {String} dest_key - Destination object key
    @param {Boolean} [is_public] - If true sets ACL 'public-read', if false 'private', if null leaves ACL unset

    @return {Object} - Service params for CopyObjectCommand
    *********************************************************************/
    commandBuilderForCopyObject: function (source_bucket, source_key, dest_bucket, dest_key, is_public) {

      // S3 expects CopySource as encoded "bucket/key"
      const service_params = {
        Bucket: dest_bucket,
        Key: dest_key,
        CopySource: encodeURIComponent(source_bucket + '/' + source_key)
      };

      // Attach optional canned ACL only when explicitly provided
      if (is_public === true) {
        service_params.ACL = 'public-read';
      }
      else if (is_public === false) {
        service_params.ACL = 'private';
      }

      return service_params;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Command Executors ~~~~~~~~~~~~~~~~~~~~
    // Execute pre-built service params against S3.

    /********************************************************************
    Execute a pre-built PutObject command (from commandBuilderForUploadObject).

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params

    @return {Promise<Object>} - { success, etag, error }
    *********************************************************************/
    commandUploadObject: async function (instance, service_params) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      try {

        // Send pre-built PutObject command
        const command = new S3Lib.PutObjectCommand(service_params);
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 PutObject - ' + service_params.Bucket + '/' + service_params.Key, instance['time_ms']);

        return {
          success: true,
          etag: response.ETag || null,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('S3 PutObject failed', { bucket: service_params.Bucket, key: service_params.Key, error: error.message });

        return {
          success: false,
          etag: null,
          error: { type: 'PUT_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Execute a pre-built GetObject command (from commandBuilderForGetObject).
    Drains the response stream and returns the body as Buffer or string.

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params
    @param {Boolean} [output_as_string] - If true returns body as UTF-8 string, else Buffer

    @return {Promise<Object>} - { success, body, content_type, metadata, error }
    *********************************************************************/
    commandGetObject: async function (instance, service_params, output_as_string) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      try {

        // Send pre-built GetObject command
        const command = new S3Lib.GetObjectCommand(service_params);
        const response = await state.client.send(command);

        // Drain SDK v3 response stream via its built-in transformers
        let body;
        if (output_as_string === true) {
          body = await response.Body.transformToString();
        }
        else {
          const bytes = await response.Body.transformToByteArray();
          body = Buffer.from(bytes);
        }

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 GetObject - ' + service_params.Bucket + '/' + service_params.Key, instance['time_ms']);

        return {
          success: true,
          body: body,
          content_type: response.ContentType || null,
          metadata: response.Metadata || {},
          error: null
        };

      }
      catch (error) {

        // Suppress log noise for expected "object not found" errors
        if (error.name !== 'NoSuchKey' && error.name !== 'NotFound') {
          Lib.Debug.debug('S3 GetObject failed', { bucket: service_params.Bucket, key: service_params.Key, error: error.message });
        }

        return {
          success: false,
          body: null,
          content_type: null,
          metadata: null,
          error: { type: error.name === 'NoSuchKey' ? 'NOT_FOUND' : 'GET_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Execute a pre-built DeleteObject command (from commandBuilderForDeleteObject).

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    commandDeleteObject: async function (instance, service_params) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      try {

        // Send pre-built DeleteObject command
        const command = new S3Lib.DeleteObjectCommand(service_params);
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 DeleteObject - ' + service_params.Bucket + '/' + service_params.Key, instance['time_ms']);

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('S3 DeleteObject failed', { bucket: service_params.Bucket, key: service_params.Key, error: error.message });

        return {
          success: false,
          error: { type: 'DELETE_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Execute a pre-built CopyObject command (from commandBuilderForCopyObject).

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    commandCopyObject: async function (instance, service_params) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      try {

        // Send pre-built CopyObject command
        const command = new S3Lib.CopyObjectCommand(service_params);
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 CopyObject - ' + service_params.Bucket + '/' + service_params.Key, instance['time_ms']);

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        // Suppress log noise for expected "object not found" errors
        if (error.name !== 'NoSuchKey' && error.name !== 'NotFound') {
          Lib.Debug.debug('S3 CopyObject failed', { bucket: service_params.Bucket, key: service_params.Key, error: error.message });
        }

        return {
          success: false,
          error: { type: error.name === 'NoSuchKey' ? 'NOT_FOUND' : 'COPY_ERROR', message: error.message }
        };

      }

    },


    // ~~~~~~~~~~~~~~~~~~~~ Convenience Functions ~~~~~~~~~~~~~~~~~~~~
    // High-level functions that build params then execute.

    /********************************************************************
    List objects in a bucket with an optional prefix filter. Returns up to
    1000 keys in a single call (S3 ListObjectsV2 default page size).

    @param {Object} instance - Request instance object reference
    @param {String} bucket - S3 bucket name
    @param {String} [prefix] - Key prefix filter

    @return {Promise<Object>} - { success, keys, error }
    *********************************************************************/
    listObjects: async function (instance, bucket, prefix) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      // Build list params - prefix is sent only when provided
      const service_params = { Bucket: bucket };
      if (!Lib.Utils.isNullOrUndefined(prefix)) {
        service_params.Prefix = prefix;
      }

      try {

        // Send ListObjectsV2 command
        const command = new S3Lib.ListObjectsV2Command(service_params);
        const response = await state.client.send(command);

        // Extract key list from response contents
        const keys = Lib.Utils.isEmpty(response.Contents)
          ? []
          : response.Contents.map(function (item) { return item.Key; });

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 ListObjectsV2 - ' + bucket, instance['time_ms']);

        return {
          success: true,
          keys: keys,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('S3 ListObjectsV2 failed', { bucket: bucket, error: error.message });

        return {
          success: false,
          keys: [],
          error: { type: 'LIST_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Upload a single file. DRY: uses commandBuilderForUploadObject + commandUploadObject.

    @param {Object} instance - Request instance object reference
    @param {String} bucket - S3 bucket name
    @param {String} key - Object key
    @param {Buffer|Uint8Array|Blob|string|Readable} body - File content
    @param {String} [content_type] - MIME type
    @param {Object} [metadata] - Custom user metadata
    @param {Boolean} [is_public] - Set ACL public-read or private

    @return {Promise<Object>} - { success, etag, error }
    *********************************************************************/
    uploadFile: async function (instance, bucket, key, body, content_type, metadata, is_public) {

      // Build service params using builder (DRY)
      const service_params = S3.commandBuilderForUploadObject(bucket, key, body, content_type, metadata, is_public);

      // Execute using command executor (DRY)
      return S3.commandUploadObject(instance, service_params);

    },


    /********************************************************************
    Upload multiple files in parallel. Each file entry mirrors the uploadFile
    signature as an object. Returns aggregate success only when every upload
    succeeds; the results array contains per-file outcomes.

    @param {Object} instance - Request instance object reference
    @param {Object[]} files - Array of file descriptors
    @param {String} files[].bucket - S3 bucket name
    @param {String} files[].key - Object key
    @param {Buffer|Uint8Array|Blob|string|Readable} files[].body - File content
    @param {String} [files[].content_type] - MIME type
    @param {Object} [files[].metadata] - Custom user metadata
    @param {Boolean} [files[].is_public] - Set ACL public-read or private

    @return {Promise<Object>} - { success, results, error }
    *********************************************************************/
    uploadFiles: async function (instance, files) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      try {

        // Fire all uploads in parallel and collect per-file outcomes
        const results = await Promise.all(files.map(function (file) {
          return S3.uploadFile(
            instance,
            file.bucket,
            file.key,
            file.body,
            file.content_type,
            file.metadata,
            file.is_public
          );
        }));

        // Aggregate success - true only when every upload succeeded
        const all_ok = results.every(function (r) { return r.success === true; });

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 BatchUpload (' + files.length + ')', instance['time_ms']);

        return {
          success: all_ok,
          results: results,
          error: all_ok ? null : { type: 'BATCH_UPLOAD_ERROR', message: 'One or more uploads failed' }
        };

      }
      catch (error) {

        Lib.Debug.debug('S3 BatchUpload failed', { count: files.length, error: error.message });

        return {
          success: false,
          results: [],
          error: { type: 'BATCH_UPLOAD_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Download a single file. DRY: uses commandBuilderForGetObject + commandGetObject.

    @param {Object} instance - Request instance object reference
    @param {String} bucket - S3 bucket name
    @param {String} key - Object key
    @param {Boolean} [output_as_string] - If true returns body as UTF-8 string, else Buffer

    @return {Promise<Object>} - { success, body, content_type, metadata, error }
    *********************************************************************/
    getFile: async function (instance, bucket, key, output_as_string) {

      // Build service params using builder (DRY)
      const service_params = S3.commandBuilderForGetObject(bucket, key);

      // Execute using command executor (DRY)
      return S3.commandGetObject(instance, service_params, output_as_string);

    },


    /********************************************************************
    Delete a single file. DRY: uses commandBuilderForDeleteObject + commandDeleteObject.

    @param {Object} instance - Request instance object reference
    @param {String} bucket - S3 bucket name
    @param {String} key - Object key

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    deleteFile: async function (instance, bucket, key) {

      // Build service params using builder (DRY)
      const service_params = S3.commandBuilderForDeleteObject(bucket, key);

      // Execute using command executor (DRY)
      return S3.commandDeleteObject(instance, service_params);

    },


    /********************************************************************
    Delete multiple files in a single bucket with automatic 1000-item chunking.
    AWS DeleteObjects limit is 1000 keys per request; this function handles
    any number of keys by recursively splitting into 1000-item chunks.

    @param {Object} instance - Request instance object reference
    @param {String} bucket - S3 bucket name
    @param {String[]} keys - Array of object keys to delete

    @return {Promise<Object>} - { success, deleted, error }
    *********************************************************************/
    deleteFiles: async function (instance, bucket, keys) {

      // Ensure S3 client is initialized
      _S3.initIfNot();

      // Fast path - nothing to do
      if (Lib.Utils.isEmpty(keys)) {
        return {
          success: true,
          deleted: [],
          error: null
        };
      }

      // Split into a 1000-item chunk and remainder for recursion
      const chunk_keys = keys.slice(0, 1000);
      const remaining_keys = keys.slice(1000);

      try {

        // Build DeleteObjects params for current chunk
        const service_params = {
          Bucket: bucket,
          Delete: {
            Objects: chunk_keys.map(function (k) { return { Key: k }; }),
            Quiet: false
          }
        };

        // Send DeleteObjects command
        const command = new S3Lib.DeleteObjectsCommand(service_params);
        const response = await state.client.send(command);

        // Extract deleted key list from response
        const deleted_chunk = Lib.Utils.isEmpty(response.Deleted)
          ? []
          : response.Deleted.map(function (item) { return item.Key; });

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'S3 DeleteObjects (' + chunk_keys.length + ')', instance['time_ms']);

        // Recurse for remaining keys if any
        if (remaining_keys.length > 0) {
          const next = await S3.deleteFiles(instance, bucket, remaining_keys);
          return {
            success: next.success,
            deleted: deleted_chunk.concat(next.deleted),
            error: next.error
          };
        }

        return {
          success: true,
          deleted: deleted_chunk,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('S3 DeleteObjects failed', { bucket: bucket, count: chunk_keys.length, error: error.message });

        return {
          success: false,
          deleted: [],
          error: { type: 'BATCH_DELETE_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Copy a single file. DRY: uses commandBuilderForCopyObject + commandCopyObject.

    @param {Object} instance - Request instance object reference
    @param {String} source_bucket - Source bucket name
    @param {String} source_key - Source object key
    @param {String} dest_bucket - Destination bucket name
    @param {String} dest_key - Destination object key
    @param {Boolean} [is_public] - Set ACL public-read or private on destination

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    copyFile: async function (instance, source_bucket, source_key, dest_bucket, dest_key, is_public) {

      // Build service params using builder (DRY)
      const service_params = S3.commandBuilderForCopyObject(source_bucket, source_key, dest_bucket, dest_key, is_public);

      // Execute using command executor (DRY)
      return S3.commandCopyObject(instance, service_params);

    },


    /********************************************************************
    Move a file: copy to destination, then delete source. If the copy fails,
    the source is left intact. Deletion failure is non-fatal - the copy has
    succeeded and the destination is authoritative.

    @param {Object} instance - Request instance object reference
    @param {String} source_bucket - Source bucket name
    @param {String} source_key - Source object key
    @param {String} dest_bucket - Destination bucket name
    @param {String} dest_key - Destination object key
    @param {Boolean} [is_public] - Set ACL public-read or private on destination

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    moveFile: async function (instance, source_bucket, source_key, dest_bucket, dest_key, is_public) {

      // Step 1: copy to destination
      const copy_result = await S3.copyFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public);
      if (!copy_result.success) {
        return copy_result;
      }

      // Step 2: delete source - copy has already succeeded at this point
      const delete_result = await S3.deleteFile(instance, source_bucket, source_key);

      return {
        success: delete_result.success,
        error: delete_result.error
      };

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _S3 = {

    /********************************************************************
    Lazy-load the AWS SDK v3 adapter. Shared across every instance because
    the SDK module itself is stateless - only the S3Client holds per-instance
    state (region, credentials, endpoint).

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      // S3 client class and command constructors (single reference; commands accessed as S3Lib.CommandName)
      if (Lib.Utils.isNullOrUndefined(S3Lib)) {
        S3Lib = require('@aws-sdk/client-s3');
      }

    },


    /********************************************************************
    Create this instance's S3 client on first use. Options are built from
    the merged CONFIG; explicit credentials, custom endpoint (for MinIO or
    other S3-compatible servers), and path-style addressing are injected
    when present.

    @return {void}
    *********************************************************************/
    initIfNot: function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.client)) {
        return;
      }

      // Adapter must be loaded before client creation
      _S3.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'S3 Client', Date.now());

      // Base client options - region and retry config
      const client_options = {
        region: CONFIG.REGION,
        maxAttempts: CONFIG.MAX_RETRIES
      };

      // Inject explicit credentials if provided via config
      if (!Lib.Utils.isNullOrUndefined(CONFIG.KEY) && !Lib.Utils.isNullOrUndefined(CONFIG.SECRET)) {
        client_options.credentials = {
          accessKeyId: CONFIG.KEY,
          secretAccessKey: CONFIG.SECRET
        };
      }

      // Set custom endpoint for S3-compatible emulators (MinIO, LocalStack, etc.)
      if (!Lib.Utils.isNullOrUndefined(CONFIG.ENDPOINT)) {
        client_options.endpoint = CONFIG.ENDPOINT;
      }

      // Enable path-style addressing for emulators that do not support virtual-hosted style
      if (CONFIG.FORCE_PATH_STYLE === true) {
        client_options.forcePathStyle = true;
      }

      // Build S3 client
      state.client = new S3Lib.S3Client(client_options);

      Lib.Debug.performanceAuditLog('Init-End', 'S3 Client', Date.now());
      Lib.Debug.debug('S3 Client Initialized', {
        region: CONFIG.REGION,
        endpoint: CONFIG.ENDPOINT || null,
        force_path_style: CONFIG.FORCE_PATH_STYLE === true
      });

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return S3;

};/////////////////////////// createInterface END ///////////////////////////////
