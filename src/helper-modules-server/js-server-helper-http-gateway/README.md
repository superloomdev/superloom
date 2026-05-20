# @superloomdev/js-server-helper-http-gateway

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

An incoming HTTP gateway module for Node.js servers. Normalizes raw runtime request data (AWS API Gateway event, Express `req`) into a per-request `instance` object and writes responses back through the same runtime — without your application code ever knowing which runtime it is running on. Part of [Superloom](https://superloom.dev).

## What This Is

A runtime-abstraction layer that sits between your application logic and the HTTP transport. One loader call returns one independent HttpGateway interface bound to one runtime adapter. The calling shape — `initHttpRequestData`, `setArgsFromRequest`, `returnHttpResponse` — is identical regardless of whether the request arrived from AWS API Gateway or an Express server.

Your application code reads `instance.http_request` and calls `returnHttpResponse`. The adapter wires it to the real runtime underneath.

## Why Use This Module

- **One codebase, two runtimes.** The same application handler runs unchanged on Docker (Express) and on AWS Lambda (API Gateway). Swap the adapter in configuration; no application rewrite.

- **Typed parameter extraction.** `setArgsFromRequest` reads from GET, POST, HEADER, PATH, or FIXED sources, typecasts (string → Number, Boolean, JSON), trims, validates, and sanitizes in one declarative pass. It returns `[null, args]` on success or `[null, false]` on validation failure — no conditional chains scattered across handler code.

- **Cookie management with browser-compatibility handling.** `setCookie` automatically omits the `SameSite=None` attribute for browsers that mishandle it (iOS 12, macOS 10.14 Safari, UC Browser, Chromium 51–66). Applications set cookies by name without managing browser quirks.

- **Runtime adapters are separate packages.** Install only the adapter for your runtime. The module has no AWS SDK or Express dependency. A future adapter for a new runtime does not change any application code.

## Architecture Overview

HttpGateway is a **factory module**. Each `require()(Lib, config)` call returns a fully independent interface bound to one adapter and one configuration.

```
HttpGateway instance
 ├─ CONFIG.ADAPTER        (adapter factory, e.g. require('...http-gateway-adapter-aws-apigateway'))
 ├─ CONFIG.ADAPTER_CONFIG (optional adapter-specific options)
 ├─ parts/cookies.js      (serialize, parse, SameSite compatibility)
 ├─ parts/url-parts.js    (tldts wrapper)
 └─ parts/params.js       (typed request parameter extraction)
```

`CONFIG.ADAPTER` is the adapter factory function itself — passed as `require(...)` directly, the same way you pass `Lib.Postgres` to other helpers.

### Adapter contract

Every adapter implements three methods:

```js
// Populate instance with normalized request data from the raw runtime input.
loadHttpDataToInstance(instance, raw_request, raw_context, response_callback)

// Build the runtime-specific response envelope.
buildHttpResponseObject(status, headers, body)  -> Object

// Return the viewer country code if the runtime can supply it (e.g. CloudFront).
// Returns null when unavailable.
getHttpRequestCountryCode(instance)  -> String | null
```

For the full adapter specification, see [`docs/api.md`](docs/api.md).

## Runtime Adapters

Two runtime adapters are available, each a separate package.

| Adapter | Runtime |
|---|---|
| [`@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-http-gateway-adapter-aws-apigateway) | AWS Lambda + API Gateway (payload v1, v2) |
| [`@superloomdev/js-server-helper-http-gateway-adapter-express`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-http-gateway-adapter-express) | Docker / Express |

Install only the adapter for your runtime.

## Adding to Your Project

```bash
npm install @superloomdev/js-server-helper-http-gateway \
            @superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway
```

Substitute the adapter package for your runtime. Loader pattern:

```js
const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway')
});

// In your Lambda handler:
exports.handler = async function (event, context, callback) {
  const instance = Lib.Instance.initialize();
  Gateway.initHttpRequestData(instance, event, context, callback);

  const [err, args] = Gateway.setArgsFromRequest(instance, [
    { method: 'GET',  name: 'page',  rename: 'page',  required: false, default: 1, is_number: true },
    { method: 'POST', name: 'email', rename: 'email', required: true, trim: true }
  ]);

  if (!args) {
    return Gateway.returnHttpStatus(instance, 'bad_request');
  }

  return Gateway.returnHttpResponse(instance, 200, null, { ok: true });
};
```

## Notes

### SameSite=None Cookie Compatibility

`setCookie` automatically manages the `SameSite=None` attribute based on the request's `User-Agent` header. Several browser families have known bugs that cause them to reject or mishandle cookies set with `SameSite=None`:

| Affected client | Bug |
|---|---|
| iOS 12 (all browsers) | Treats `SameSite=None` as `SameSite=Strict` — cookie is blocked on cross-site requests |
| macOS 10.14 Safari and embedded browser | Same WebKit bug as iOS 12 |
| UC Browser < 12.13.2 | Drops the cookie entirely when `SameSite=None` is present |
| Chromium 51–66 | Drops any cookie with an unrecognised `SameSite` value |

For these clients, `setCookie` serializes the cookie **without** any `SameSite` attribute. Modern browsers (Chromium 67+, Safari 13+, Firefox 79+) receive `SameSite=None; Secure` as intended by RFC 6265bis.

This detection is based on the [Chromium SameSite incompatible clients list](https://www.chromium.org/updates/same-site/incompatible-clients). If `User-Agent` is absent, `SameSite=None` is included (no browsers in production omit `User-Agent`).

If you set cookies yourself using raw `Set-Cookie` headers rather than `setCookie`, you are responsible for this UA check.

### Multipart/Form-Data Not Supported

This module does **not** support `multipart/form-data` request bodies. Sending a multipart request will result in an empty `instance.http_request.post` — the body is not parsed and no error is raised.

Use `application/json` or `application/x-www-form-urlencoded` for all POST data. Multipart support will be added in a future version via a dedicated adapter-level option; the current contract is intentionally scoped to text payloads.

## Third-Party Dependencies

This module declares the following runtime npm dependencies. Each was accepted under the criteria in [`docs/foundations/third-party-libraries.md`](../../../../docs/foundations/third-party-libraries.md).

### `cookie` (jshttp)

Used for RFC 6265-compliant cookie string serialization (`stringifySetCookie`) and request header parsing (`parseCookie`). In-house code is not used because cookie handling contains several non-obvious security pitfalls: attribute injection via unencoded values, prototype pollution via hostile `__proto__=...` Cookie headers (CVE-2024-47764 class), and `decodeURIComponent` crashes on malformed percent-encoded sequences. The library encapsulates 13 years of fixes to these pitfalls and tracks ongoing RFC 6265bis grammar revisions. The SameSite=None browser-quirk detection is handled in-house in `parts/cookies.js` because it is a product decision based on a historical browser bug list, not part of any RFC.

### `tldts`

Used to split a hostname into its registrable domain and public suffix via the Mozilla Public Suffix List. In-house code is not used because the Public Suffix List has thousands of entries, changes monthly with new ccTLDs and private suffixes, and cannot be approximated by any programmatic rule (there is no algorithm that determines `.co.uk` is a public suffix without the list).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit (offline) | Node.js `node --test` against an in-process stub adapter | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

The gateway's own tests use the in-process stub adapter (`_test/stub-adapter.js`) which satisfies the three-method adapter contract with minimal fixed-output behavior. It is not a simulation of API Gateway or Express internals — it exists only to let the gateway module exercise its own logic without any real runtime. Integration tests for each runtime adapter live in the corresponding adapter package.

```
▶ loader validation
  ✔ throws when ADAPTER is missing
  ✔ throws when ADAPTER is a string
  ✔ throws when ADAPTER is null
  ✔ succeeds with a valid adapter factory
▶ initHttpRequestData
  ✔ populates instance.http_request from raw_request
  ✔ sets empty collections when raw_request is null
  ✔ gateway_response_callback is a function
▶ isHttpInstance
  ✔ returns false on a fresh un-initialized instance
  ✔ returns true after initHttpRequestData
▶ returnHttpResponse
  ✔ sends the correct status code
  ✔ includes default Cache-Control and Content-Type headers
  ✔ merges caller-supplied headers over defaults
  ✔ flushes instance cookies into the response headers
  ✔ returns true
▶ returnHttpStatus
  ✔ sends 304 for status_name=not_modified
  ✔ sends 400 for status_name=bad_request
  ✔ sends 401 for status_name=unauthorized
  ✔ sends 404 for status_name=not_found
  ✔ sends 498 for status_name=invalid_token
▶ returnHttpRedirect
  ✔ sends status 301
  ✔ sets Location header
▶ returnHttpRedirect404
  ✔ redirects to /404
▶ getRequestIPAddress
  ✔ returns first IP from x-forwarded-for chain
  ✔ returns empty string when header is absent
▶ getRequestUserAgent
  ✔ returns user-agent from headers
  ✔ returns empty string when absent
▶ getRequestOrigin
  ✔ returns origin header
  ✔ returns empty string when absent
▶ getRequestCountryCode
  ✔ returns null from stub adapter (no CDN)
▶ setCookie
  ✔ sets Set-Cookie on instance.http_response.cookies
  ✔ includes SameSite=None for a compatible browser (Chrome 100)
  ✔ omits SameSite=None for iOS 12 UA
  ✔ omits SameSite when user-agent is absent
▶ getHttpTime
  ✔ returns a string in HTTP-date format for a given timestamp
  ✔ returns current time string when no argument given
▶ getUrlParts
  ✔ correctly parses a standard URL
▶ parts/cookies - isSameSiteNoneIncompatible
  ✔ returns false for modern Chrome
  ✔ returns true for iOS 12
  ✔ returns true for Chromium 65 (drops unrecognized SameSite)
  ✔ returns false for Chromium 67 (first compatible version)
  ✔ returns false for an empty string
▶ parts/cookies - serialize
  ✔ URL-encodes a value containing reserved cookie-octet characters
  ✔ emits an empty value when the input is an empty string
  ✔ throws on a cookie name containing a space
  ✔ throws on a cookie name containing a semicolon
▶ parts/cookies - parse
  ✔ URL-decodes percent-encoded values
  ✔ preserves the raw value when percent-encoding is malformed
  ✔ returns a prototype-less object (prototype pollution defense)
  ✔ does not pollute Object.prototype when header contains __proto__
  ✔ returns an empty prototype-less object for an empty header
  ✔ parses multiple cookies separated by semicolons
▶ parts/params - setArgsFromRequest
  ✔ returns [null, {}] for empty params array
  ✔ extracts a GET param
  ✔ extracts a POST param
  ✔ extracts a HEADER param
  ✔ extracts a PATH param
  ✔ extracts a FIXED param
  ✔ applies default value when optional param is absent
  ✔ returns [null, false] when required param is missing
  ✔ typecasts string to number when is_number=true
  ✔ typecasts to boolean when is_boolean=true
  ✔ parses JSON string when is_json=true
  ✔ returns [null, false] when is_json=true and value is invalid JSON and required
  ✔ trims whitespace and converts empty string to null
  ✔ returns [null, false] when validate_func fails
  ✔ returns [err, false] when invalidate_func returns an error object
  ✔ handles multiple params in sequence
▶ parts/url-parts - getUrlParts
  ✔ parses subdomain, domain, tld correctly
  ✔ marks IP addresses as is_ip=true
  ✔ returns object with all expected keys

ℹ tests 70 | pass 70 | fail 0
```

## License

MIT
