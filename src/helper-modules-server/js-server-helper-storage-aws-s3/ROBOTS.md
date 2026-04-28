# js-server-helper-aws-s3

AWS S3 file storage: list, upload, download, delete, copy, move. Lazy-loaded SDK v3. Explicit credentials.

## Type
Server helper. Service-dependent (needs Docker/MinIO for emulated, AWS for integration).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance`

## Direct Dependencies
- `@aws-sdk/client-s3` - S3 client + command constructors

## Loader Pattern (Factory)

```javascript
Lib.S3 = require('@superloomdev/js-server-helper-aws-s3')(Lib, { /* config overrides */ });
```

Each loader call returns an independent S3 interface with its own `Lib`, `CONFIG`, and S3 client instance.

## Config Keys
| Key | Type | Default | Required |
|---|---|---|---|
| REGION | String | 'us-east-1' | yes |
| KEY | String | undefined | yes (AWS access key) |
| SECRET | String | undefined | yes (AWS secret key) |
| ENDPOINT | String | undefined | no (set for MinIO/LocalStack) |
| FORCE_PATH_STYLE | Boolean | false | no (set true for MinIO) |
| MAX_RETRIES | Number | 3 | no |

## Exported Functions (13 total)

All functions with `instance` param use `instance.time_ms` for request-level performance timeline.

### Builders (pure, no I/O - used by executors and custom orchestration)

commandBuilderForUploadObject(bucket, key, body, content_type?, metadata?, is_public?) → Object | async:no
  Build PutObject service params. Attaches Metadata and ACL only when provided.

commandBuilderForGetObject(bucket, key) → Object | async:no
  Build GetObject service params. { Bucket, Key }

commandBuilderForDeleteObject(bucket, key) → Object | async:no
  Build DeleteObject service params. { Bucket, Key }

commandBuilderForCopyObject(source_bucket, source_key, dest_bucket, dest_key, is_public?) → Object | async:no
  Build CopyObject service params. CopySource is URL-encoded "bucket/key".

### Command Executors (I/O - execute pre-built params)

commandUploadObject(instance, service_params) → { success, etag, error } | async:yes
  Execute pre-built PutObject command.

commandGetObject(instance, service_params, output_as_string?) → { success, body, content_type, metadata, error } | async:yes
  Execute pre-built GetObject command. Drains stream via SDK v3 transformToByteArray/transformToString.
  On NoSuchKey, returns error.type = 'NOT_FOUND' (log suppressed).

commandDeleteObject(instance, service_params) → { success, error } | async:yes
  Execute pre-built DeleteObject command.

commandCopyObject(instance, service_params) → { success, error } | async:yes
  Execute pre-built CopyObject command. NoSuchKey error log suppressed.

### Convenience (DRY - build + execute internally)

listObjects(instance, bucket, prefix?) → { success, keys, error } | async:yes
  List up to 1000 keys via ListObjectsV2. Prefix optional.

uploadFile(instance, bucket, key, body, content_type?, metadata?, is_public?) → { success, etag, error } | async:yes
  Upload single file. Uses commandBuilderForUploadObject + commandUploadObject.

uploadFiles(instance, files) → { success, results, error } | async:yes
  Upload multiple files in parallel via Promise.all. files = [{ bucket, key, body, content_type?, metadata?, is_public? }].
  success=true only when every upload succeeded; results has per-file outcomes.

getFile(instance, bucket, key, output_as_string?) → { success, body, content_type, metadata, error } | async:yes
  Download single file. Uses commandBuilderForGetObject + commandGetObject.
  output_as_string=true returns string, otherwise Buffer.

deleteFile(instance, bucket, key) → { success, error } | async:yes
  Delete single file. Uses commandBuilderForDeleteObject + commandDeleteObject.

deleteFiles(instance, bucket, keys) → { success, deleted, error } | async:yes
  Delete multiple files with auto 1000-item chunking (AWS DeleteObjects limit).
  Recursive - processes any number of keys.

copyFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public?) → { success, error } | async:yes
  Copy file within or across buckets. Uses commandBuilderForCopyObject + commandCopyObject.

moveFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public?) → { success, error } | async:yes
  Copy then delete source. Source preserved if copy fails. Delete failure becomes the returned error.

## Patterns
- 3-layer DRY: Builder → Command Executor → Convenience function
- Instance first: every I/O function receives instance for request-level performance tracking
- Lazy loading: SDK loaded on first function call via ensureAdapter + initIfNot
- Performance: Lib.Debug.performanceAuditLog with instance.time_ms
- Credentials: explicit KEY + SECRET via config, not implicit env chain
- Stream reading: SDK v3 Body.transformToByteArray() / transformToString() (no manual chunking)
- Batch limits: deleteFiles handles 1000-item AWS limit with recursion
- MinIO compatibility: CONFIG.FORCE_PATH_STYLE=true enables path-style addressing
- Error handling: returns { success: false, error: { type, message } } - never throws
- NotFound discrimination: NoSuchKey maps to error.type 'NOT_FOUND' and suppresses log noise
