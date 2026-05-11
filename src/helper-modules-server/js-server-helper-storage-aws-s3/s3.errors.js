'use strict';

/**
 * Error catalog for js-server-helper-storage-aws-s3.
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  STORAGE_UPLOAD_FAILED: Object.freeze({
    type: 'STORAGE_UPLOAD_FAILED',
    message: 'Storage upload operation failed'
  }),

  STORAGE_DOWNLOAD_FAILED: Object.freeze({
    type: 'STORAGE_DOWNLOAD_FAILED',
    message: 'Storage download operation failed'
  }),

  STORAGE_NOT_FOUND: Object.freeze({
    type: 'STORAGE_NOT_FOUND',
    message: 'Storage object not found'
  }),

  STORAGE_DELETE_FAILED: Object.freeze({
    type: 'STORAGE_DELETE_FAILED',
    message: 'Storage delete operation failed'
  }),

  STORAGE_COPY_FAILED: Object.freeze({
    type: 'STORAGE_COPY_FAILED',
    message: 'Storage copy operation failed'
  }),

  STORAGE_LIST_FAILED: Object.freeze({
    type: 'STORAGE_LIST_FAILED',
    message: 'Storage list operation failed'
  }),

  STORAGE_BATCH_UPLOAD_FAILED: Object.freeze({
    type: 'STORAGE_BATCH_UPLOAD_FAILED',
    message: 'Storage batch upload failed'
  }),

  STORAGE_BATCH_DELETE_FAILED: Object.freeze({
    type: 'STORAGE_BATCH_DELETE_FAILED',
    message: 'Storage batch delete failed'
  })

});
