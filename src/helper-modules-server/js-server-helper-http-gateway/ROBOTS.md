# @superloomdev/js-server-helper-http-gateway

**Class:** B (Extended Utility - Node.js runtime only)
**Scope:** Incoming HTTP gateway for Node.js servers. Normalizes raw runtime request data (AWS API Gateway event, Express req) into a per-request instance object and writes responses back through the same runtime.

---

## Factory Loader

```javascript
const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway'),
  ADAPTER_CONFIG: {} // optional, adapter-specific
});
```

**Config validation:** Throws at construction time if `ADAPTER` is missing or not a function.

**Peer dependencies in Lib:** Utils, Debug, Instance

---

## Public Interface

### Request Lifecycle

```javascript
// Initialize HTTP request data in instance from raw runtime data
Gateway.initHttpRequestData(instance, raw_request, raw_context, response_callback);
// Returns: void

// Check if instance was initialized with HTTP request data
Gateway.isHttpInstance(instance);
// Returns: Boolean
```

### Parameter Extraction

```javascript
// Build typed, validated args from instance.http_request
Gateway.setArgsFromRequest(instance, params);
// Returns: [null, args] | [null, false] | [err, false]

// Param descriptor shape:
// {
//   method: 'GET' | 'POST' | 'PATH' | 'HEADER' | 'FIXED',
//   name: String,           // key in source location
//   rename: String,          // output key name
//   value: *,                // literal value (FIXED only)
//   required: Boolean,
//   default: *,
//   is_number: Boolean,      // typecast to Number
//   is_boolean: Boolean,     // typecast via Boolean(Number(v))
//   is_json: Boolean,        // JSON.parse
//   trim: Boolean,           // trim whitespace, empty->null
//   json_func: Function,     // transform after JSON.parse
//   sanatize_func: Function, // sanitization function
//   validate_func: Function, // must return truthy
//   invalidate_func: Function // must return falsy; truthy becomes [err, false]
// }
```

### Response Functions

```javascript
// Send HTTP response with status, headers, body
Gateway.returnHttpResponse(instance, status, headers?, body?);
// Returns: Boolean (always true)

// Send body-less status response
Gateway.returnHttpStatus(instance, status_name);
// status_name: 'not_modified' | 'bad_request' | 'unauthorized' | 'not_found' | 'invalid_token'
// Returns: Boolean (always true)

// Send 301 redirect
Gateway.returnHttpRedirect(instance, location);
// Returns: Boolean (always true)

// Send 301 redirect to /404
Gateway.returnHttpRedirect404(instance);
// Returns: Boolean (always true)
```

### Request Accessors

```javascript
// Get client IP from x-forwarded-for header (first in chain)
Gateway.getRequestIPAddress(instance);
// Returns: String (empty string if absent)

// Get User-Agent header
Gateway.getRequestUserAgent(instance);
// Returns: String (empty string if absent)

// Get Origin header
Gateway.getRequestOrigin(instance);
// Returns: String (empty string if absent)

// Get country code from CDN if available
Gateway.getRequestCountryCode(instance);
// Returns: String | null
```

### Utilities

```javascript
// Set cookie with automatic SameSite=None handling for incompatible browsers
Gateway.setCookie(instance, cookie_name, cookie_value, cookie_life_seconds);
// Returns: void
// SameSite=None omitted for: iOS 12, macOS 10.14 Safari, UC Browser < 12.13.2, Chromium 51-66

// Format Unix timestamp as HTTP-date string
Gateway.getHttpTime(timestamp_seconds?);
// Returns: String (current time if no arg)
// Format: "Wed, 21 Oct 2015 07:28:00 GMT"

// Parse URL into component parts
Gateway.getUrlParts(url);
// Returns: {
//   sub_domain: String,
//   domain: String,
//   domain_without_tld: String,
//   tld: String,
//   hostname: String,
//   is_ip: Boolean
// }
```

---

## Adapter Contract (for adapter implementers)

Every adapter implements:

```javascript
// Populate instance.http_request, http_response, gateway_response_callback
adapter.loadHttpDataToInstance(instance, raw_request, raw_context, response_callback);

// Build runtime-specific response envelope
adapter.buildHttpResponseObject(status, headers, body);
// Returns: Object

// Return country code if available
adapter.getHttpRequestCountryCode(instance);
// Returns: String | null
```

---

## Error Catalog

```javascript
{
  INVALID_PARAM: {
    type: 'HTTP_GATEWAY_INVALID_PARAM',
    message: 'One or more required request parameters are missing or invalid'
  },
  NOT_IMPLEMENTED: {
    type: 'NOT_IMPLEMENTED',
    message: 'This operation is not yet implemented for this adapter'
  }
}
```

---

## Important Constraints

**Multipart/form-data not supported:** POST bodies must be `application/json` or `application/x-www-form-urlencoded`. Multipart requests result in empty `instance.http_request.post`.

**SameSite=None browser compatibility:** `setCookie` automatically detects incompatible browsers (iOS 12, macOS 10.14 Safari, UC Browser < 12.13.2, Chromium 51-66) and omits the SameSite attribute for them.

**Default headers:** `returnHttpResponse` adds `Cache-Control: max-age=0` and `Content-Type: application/json` unless overridden by caller-supplied headers.

---

## Dependencies

**Bundled:** `cookie@1.x`, `tldts@5.x`

**Peer (in Lib):** js-helper-utils, js-helper-debug, js-server-helper-instance

**Optional peer:** Runtime adapter (aws-apigateway or express)

---

## Testing

Tests use in-process stub adapter. No external services required.

```bash
cd _test && npm install && npm test
```

Coverage: loader validation, all public methods, SameSite=None browser detection, param extraction with all typecasts and validators.
