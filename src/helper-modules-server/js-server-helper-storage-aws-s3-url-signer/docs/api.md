# API Reference. `js-server-helper-storage-aws-s3-url-signer`

Every exported function on the public interface, with parameters, return shape, and worked examples. For configuration, environment variables, IAM permissions, and runtime patterns see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Three URL Shapes](#three-url-shapes)
- [`generateUploadUrlPut`](#generateuploadurlputbucket-key-content_type-options)
- [`generateUploadUrlPost`](#generateuploadurlpostbucket-key-content_type-options)
- [`generateDownloadUrlGet`](#generatedownloadurlgetbucket-key-options)
- [Client-Side Usage](#client-side-usage)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function is async and resolves with an object. None of them throw on operational failure. The shape is one of:

```javascript
// success
{ success: true, url: '...', fields: {...}, error: null }

// failure
{ success: false, url: null, fields: null, error: { type, message } }
```

Branch on `result.success` and read `result.url` (or `result.fields` for POST uploads) on success. On failure, `result.error.type` is a stable string you can branch on; `result.error.message` is human-readable. The error catalog is the same shape and contents as `s3-url-signer.errors.js` in the module source.

The first argument to every signing function is the **bucket name** (a string). The bucket is not configured at loader time. This makes it natural to sign URLs against multiple buckets from the same loaded instance.

## Three URL Shapes

The module produces presigned URLs in three shapes. Pick the one that matches how the client side will use the URL:

| Function | HTTP method | When to use |
|---|---|---|
| `generateUploadUrlPut` | PUT | Default upload. Easiest for `fetch`, `axios`, mobile SDKs, server-to-server. The body is the raw file. |
| `generateUploadUrlPost` | POST (multipart) | Browser HTML form uploads. The browser builds a multipart payload using the returned `fields` plus the file. |
| `generateDownloadUrlGet` | GET | Direct downloads. Optionally supports a `Content-Disposition` override so a file opens with a chosen filename or attaches as a download. |

PUT is almost always what you want for programmatic clients. POST exists for the rare case where a plain `<form enctype="multipart/form-data">` is the only option (and even then, modern browsers can use PUT via `fetch` with `Content-Type` set on the request).

---

## `generateUploadUrlPut(bucket, key, content_type, options?)`

Generate a short-lived URL the client can PUT a file to. The URL signs only the upload action; the body of the PUT becomes the object stored at `key`.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `bucket` | `String` | Yes | The S3 bucket name |
| `key` | `String` | Yes | The object key (path/filename) inside the bucket. Slashes become folders in the AWS console |
| `content_type` | `String` | Yes | The MIME type of the upload. The client must send the same `Content-Type` header on the PUT or AWS will reject the signature |
| `options.expiresIn` | `Number` | No | Seconds until the URL expires. Defaults to the loader-configured `UPLOAD_URL_EXPIRY` (15 minutes) |

**Returns:** `Promise<{ success, url, fields, error }>`

| Field | Type | On success | On failure |
|---|---|---|---|
| `success` | `Boolean` | `true` | `false` |
| `url` | `String \| null` | The presigned URL | `null` |
| `fields` | `Object` | `{}` (empty for PUT uploads) | `null` |
| `error` | `Object \| null` | `null` | `{ type: 'STORAGE_URL_GENERATION_FAILED', message: 'Storage presigned URL generation failed' }` |

**Example:**

```javascript
const result = await Lib.S3UrlSigner.generateUploadUrlPut(
  'user-uploads',
  'avatars/user-123/profile.png',
  'image/png',
  { expiresIn: 600 } // 10 minutes
);

if (!result.success) {
  return ServerError(req, res, result.error);
}

// Send result.url to the client. They PUT the file body directly:
//   await fetch(result.url, { method: 'PUT', body: fileBlob, headers: { 'Content-Type': 'image/png' } })
res.json({ upload_url: result.url, expires_at: Date.now() + 600 * 1000 });
```

---

## `generateUploadUrlPost(bucket, key, content_type, options?)`

Generate a presigned URL plus a `fields` object the client side combines into a multipart/form-data POST. Useful for plain HTML `<form>` uploads.

**Parameters:** same as `generateUploadUrlPut` (`bucket`, `key`, `content_type`, `options.expiresIn`).

**Returns:** `Promise<{ success, url, fields, error }>`

| Field | Type | On success | On failure |
|---|---|---|---|
| `success` | `Boolean` | `true` | `false` |
| `url` | `String \| null` | The presigned POST endpoint | `null` |
| `fields` | `Object` | `{ key: '...', 'Content-Type': '...' }` | `null` |
| `error` | `Object \| null` | `null` | `{ type: 'STORAGE_URL_GENERATION_FAILED', ... }` |

**Example:**

```javascript
const result = await Lib.S3UrlSigner.generateUploadUrlPost(
  'user-uploads',
  'documents/contract-' + uuid + '.pdf',
  'application/pdf'
);

if (!result.success) {
  return ServerError(req, res, result.error);
}

// Send both url and fields to the client. The browser builds:
//   <form action={result.url} method="POST" enctype="multipart/form-data">
//     {Object.entries(result.fields).map(([k, v]) => <input type="hidden" name={k} value={v} />)}
//     <input type="file" name="file" />
//   </form>
res.json({ post_url: result.url, fields: result.fields });
```

> **Implementation note.** The current implementation generates a PUT-style presigned URL under the hood and returns a static `fields` object containing `{ key, 'Content-Type' }`. For full POST policy support (file size limits, allowed prefix matching, etc.), use the AWS SDK `createPresignedPost` API directly or extend this module.

---

## `generateDownloadUrlGet(bucket, key, options?)`

Generate a short-lived URL the client can GET to download an object directly from S3.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `bucket` | `String` | Yes | The S3 bucket name |
| `key` | `String` | Yes | The object key |
| `options.expiresIn` | `Number` | No | Seconds until the URL expires. Defaults to the loader-configured `DOWNLOAD_URL_EXPIRY` (1 hour) |
| `options.responseContentDisposition` | `String` | No | An override for the `Content-Disposition` response header. Common values: `attachment; filename="invoice.pdf"`, `inline` |

**Returns:** `Promise<{ success, url, error }>`

| Field | Type | On success | On failure |
|---|---|---|---|
| `success` | `Boolean` | `true` | `false` |
| `url` | `String \| null` | The presigned download URL | `null` |
| `error` | `Object \| null` | `null` | `{ type: 'STORAGE_URL_GENERATION_FAILED', ... }` |

**Example:**

```javascript
const result = await Lib.S3UrlSigner.generateDownloadUrlGet(
  'user-uploads',
  'documents/contract-456.pdf',
  {
    expiresIn: 300, // 5 minutes; just enough to start the download
    responseContentDisposition: 'attachment; filename="contract.pdf"'
  }
);

if (!result.success) {
  return ServerError(req, res, result.error);
}

// Redirect or send back the URL for the browser to fetch.
res.redirect(302, result.url);
```

---

## Client-Side Usage

The URLs the module returns are short-lived (default 15 minutes upload, 1 hour download) and meant for the client to use immediately. They bind to the original method (PUT or GET), the bucket, the key, and (for uploads) the `Content-Type` header. If the client sends a different method, key, or content type, AWS rejects the request.

Practical client snippets:

**PUT upload (browser, native fetch):**

```javascript
await fetch(presigned_url, {
  method: 'PUT',
  body: file_blob,
  headers: { 'Content-Type': 'image/png' } // must match the contentType passed to generateUploadUrlPut
});
```

**POST upload (HTML form, no JavaScript):**

```html
<form action="https://s3-presigned-url..." method="POST" enctype="multipart/form-data">
  <input type="hidden" name="key" value="uploads/document.pdf" />
  <input type="hidden" name="Content-Type" value="application/pdf" />
  <input type="file" name="file" />
  <button type="submit">Upload</button>
</form>
```

**GET download (browser):**

```html
<a href={presigned_url}>Download</a>
```

The browser navigates straight to S3. Your application server is not in the data path.

---

## Lifecycle

The module is a singleton. The first call lazy-loads `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` and constructs an `S3Client` from the loader-merged config. Every subsequent call reuses the same client instance.

There is no `close()` function. The S3 client is stateless from a network perspective (signing is an in-memory cryptographic operation; the SDK does not hold persistent connections for presigner-only usage). Nothing needs to be torn down at process exit.

For multi-region or multi-account use cases, load the module multiple times. See [Configuration → Multi-Region / Multi-Account Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/docs/configuration.md#multi-region--multi-account-setup).
