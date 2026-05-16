# API Reference — `js-server-helper-storage-aws-s3`

Every exported function with its signature, parameters, return shape, semantics, and examples. For configuration keys, credentials, IAM permissions, and runtime patterns see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Three-Layer Pattern](#three-layer-pattern)
- [Command Builders](#command-builders) *(pure, no I/O)*
  - [`commandBuilderForUploadObject`](#commandbuilderforuploadobject)
  - [`commandBuilderForGetObject`](#commandbuilderforgetobject)
  - [`commandBuilderForDeleteObject`](#commandbuilderfordeleteobject)
  - [`commandBuilderForCopyObject`](#commandbuilderforcopyobject)
- [Command Executors](#command-executors) *(async I/O)*
  - [`commandUploadObject`](#commanduploadobject)
  - [`commandGetObject`](#commandgetobject)
  - [`commandDeleteObject`](#commanddeleteobject)
  - [`commandCopyObject`](#commandcopyobject)
- [File Operations](#file-operations) *(convenience)*
  - [`listObjects`](#listobjects)
  - [`uploadFile`](#uploadfile)
  - [`uploadFiles`](#uploadfiles)
  - [`getFile`](#getfile)
  - [`deleteFile`](#deletefile)
  - [`deleteFiles`](#deletefiles)
  - [`copyFile`](#copyfile)
  - [`moveFile`](#movefile)

---

## Conventions

All I/O functions are **async** and accept `instance` as their first argument. The `instance` is built once per request by your application's loader (typically using [`@superloomdev/js-server-helper-instance`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-instance)) and threaded through the call chain; it is what gives every operation a stable `instance.time_ms` for request-level timing.

Every function returns a consistent response envelope:

```javascript
{ success: true,  /* result fields */, error: null }
{ success: false, /* zeroed fields */, error: { type, message } }
```

Operational failures (network error, access denied, missing object) never throw — they come back through `error` so the caller can branch without a try/catch. Programming errors (bad arguments, missing peers) still throw.

**`NoSuchKey` is normalised.** When an object does not exist, the response is `{ success: false, error: { type: 'NOT_FOUND', message: ... } }` regardless of the AWS-specific error code. The error log entry is suppressed for `NOT_FOUND` to avoid noise on cache-miss-style code paths.

---

## Three-Layer Pattern

This module exposes its single-object operations through three layers, each useful in different situations:

| Layer | Functions | When to use |
|---|---|---|
| **Builder** (pure) | `commandBuilderForUploadObject`, `commandBuilderForGetObject`, `commandBuilderForDeleteObject`, `commandBuilderForCopyObject` | Build a command object ahead of time. Useful if you want to inspect or modify the SDK params before they go out. |
| **Executor** (async) | `commandUploadObject`, `commandGetObject`, `commandDeleteObject`, `commandCopyObject` | Execute a pre-built command. Pair with a builder when you need fine-grained control. |
| **Convenience** (async) | `listObjects`, `uploadFile`, `uploadFiles`, `getFile`, `deleteFile`, `deleteFiles`, `copyFile`, `moveFile` | Build + execute in one call. Use for ordinary application code. |

Most application code uses the **Convenience** layer. The **Builder + Executor** layers are exposed for advanced workflows that want to compose commands before dispatch.

---

## Command Builders

Builders are **pure functions** that produce S3 service-parameter objects. They do not call AWS — they prepare arguments that an executor will send.

### `commandBuilderForUploadObject`

```javascript
commandBuilderForUploadObject(bucket, key, body, content_type, metadata, is_public) → Object
```

Build a `PutObject` service-params object. `Metadata` and `ACL` are attached only when provided.

| Parameter | Type | Description |
|---|---|---|
| `bucket` | `String` | Bucket name |
| `key` | `String` | Object key |
| `body` | `Buffer \| String \| Stream` | Object content |
| `content_type` | `String` *(optional)* | MIME type (e.g. `'image/png'`). Omitted from the request when not provided |
| `metadata` | `Object<String, String>` *(optional)* | Custom user-defined metadata (S3 metadata keys are case-folded) |
| `is_public` | `Boolean` *(optional)* | When `true`, sets `ACL: 'public-read'`. Default leaves ACL unset (bucket policy decides) |

### `commandBuilderForGetObject`

```javascript
commandBuilderForGetObject(bucket, key) → Object
```

Build a `GetObject` service-params object. Returns `{ Bucket, Key }`.

### `commandBuilderForDeleteObject`

```javascript
commandBuilderForDeleteObject(bucket, key) → Object
```

Build a `DeleteObject` service-params object. Returns `{ Bucket, Key }`.

### `commandBuilderForCopyObject`

```javascript
commandBuilderForCopyObject(source_bucket, source_key, dest_bucket, dest_key, is_public) → Object
```

Build a `CopyObject` service-params object. `CopySource` is URL-encoded `bucket/key` per the SDK requirement. `is_public` sets `ACL: 'public-read'` when `true`.

---

## Command Executors

Executors are **async** and accept a pre-built `service_params` object from a builder.

### `commandUploadObject`

```javascript
async commandUploadObject(instance, service_params) → { success, etag, error }
```

Execute a pre-built `PutObject` command. `etag` is the S3-assigned entity tag (useful for client-side caching).

### `commandGetObject`

```javascript
async commandGetObject(instance, service_params, output_as_string) → { success, body, content_type, metadata, error }
```

Execute a pre-built `GetObject` command. The streamed response body is drained automatically via the SDK's `transformToByteArray()` / `transformToString()` — no manual chunking needed.

| `output_as_string` | `body` shape |
|---|---|
| `true` | `String` |
| `false` (default) | `Buffer` |

On a missing key, returns `{ success: false, body: null, content_type: null, metadata: null, error: { type: 'NOT_FOUND', ... } }`.

### `commandDeleteObject`

```javascript
async commandDeleteObject(instance, service_params) → { success, error }
```

Execute a pre-built `DeleteObject` command. S3's `DeleteObject` is idempotent — deleting a non-existent key still returns `success: true`.

### `commandCopyObject`

```javascript
async commandCopyObject(instance, service_params) → { success, error }
```

Execute a pre-built `CopyObject` command. `NoSuchKey` (missing source) returns `error.type: 'NOT_FOUND'` with the log entry suppressed.

---

## File Operations

The convenience layer — builds and executes in a single call. Use these for ordinary application code.

### `listObjects`

```javascript
async listObjects(instance, bucket, prefix) → { success, keys, error }
```

List up to 1000 keys in a bucket using `ListObjectsV2`. `prefix` is optional. `keys` is always an array of strings (the key names — `Contents.Key` from the SDK response).

```javascript
const res = await Lib.S3.listObjects(instance, 'uploads', 'users/42/');
console.log(res.keys);   // ['users/42/avatar.jpg', 'users/42/document.pdf', ...]
```

Returns only the first page (AWS limit). For larger result sets, paginate manually using the SDK's `ContinuationToken` via builders + executors.

### `uploadFile`

```javascript
async uploadFile(instance, bucket, key, body, content_type, metadata, is_public) → { success, etag, error }
```

Upload a single file. Builds `PutObject` params + executes in one call.

```javascript
await Lib.S3.uploadFile(
  instance,
  'uploads',
  'users/42/avatar.png',
  buffer,
  'image/png',
  { uploaded_by: 'user_42' },
  false
);
```

### `uploadFiles`

```javascript
async uploadFiles(instance, files) → { success, results, error }
```

Upload multiple files in **parallel** via `Promise.all`. `files` is an array of `{ bucket, key, body, content_type?, metadata?, is_public? }`.

`success` is `true` only when **every** upload succeeded. `results` is the per-file response array — inspect it to find the specific failures when `success === false`.

```javascript
const res = await Lib.S3.uploadFiles(instance, [
  { bucket: 'docs', key: 'a.txt', body: 'hello' },
  { bucket: 'docs', key: 'b.txt', body: 'world' }
]);
```

### `getFile`

```javascript
async getFile(instance, bucket, key, output_as_string) → { success, body, content_type, metadata, error }
```

Download a single object. Returns the body as a `Buffer` by default, or as a `String` when `output_as_string` is `true`.

```javascript
const res = await Lib.S3.getFile(instance, 'docs', 'readme.txt', true);
if (res.error?.type === 'NOT_FOUND') { /* missing object */ }
console.log(res.body);   // 'Hello world'
```

### `deleteFile`

```javascript
async deleteFile(instance, bucket, key) → { success, error }
```

Delete a single object. Idempotent — deleting a key that does not exist still returns `success: true`.

### `deleteFiles`

```javascript
async deleteFiles(instance, bucket, keys) → { success, deleted, error }
```

Delete multiple objects from a single bucket. **Handles the AWS 1000-key `DeleteObjects` limit automatically** — pass any number of keys and the helper recurses through 1000-key chunks until everything is deleted.

`deleted` is the total count of successfully deleted keys across all chunks.

```javascript
await Lib.S3.deleteFiles(instance, 'uploads', listOfThousandsOfKeys);
```

### `copyFile`

```javascript
async copyFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public) → { success, error }
```

Copy an object within or across buckets. `is_public` sets `ACL: 'public-read'` on the destination when `true`.

### `moveFile`

```javascript
async moveFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public) → { success, error }
```

Copy then delete the source. **Source is preserved if the copy fails** — the move only continues to the delete step on a successful copy. If the delete subsequently fails, the delete error becomes the returned `error`.

```javascript
await Lib.S3.moveFile(
  instance,
  'staging-bucket', 'tmp/file.txt',
  'prod-bucket',    'final/file.txt'
);
```
