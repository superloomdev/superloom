// Info: AWS Lambda + API Gateway adapter for js-server-helper-http-gateway.
// Normalizes API Gateway payload format v2.0 (HTTP API / Lambda Function URLs)
// into the standard instance.http_request shape consumed by the gateway.
//
// Adapter contract:
//   loadHttpDataToInstance(instance, raw_request, raw_context, response_callback)
//   buildHttpResponseObject(status, headers, body)
//   getHttpRequestCountryCode(instance) -> String | null
//
// Reference: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
//
// Compatibility: Node.js 24+
'use strict';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. Called by http-gateway.js as CONFIG.ADAPTER(Lib, CONFIG, ERRORS).
Returns the 3-method adapter object. Each loader call returns the same
stateless adapter singleton - all request state lives on instance.

@param {Object} _lib    - Lib container (unused; accepted for contract conformance)
@param {Object} _config - Merged CONFIG (unused; accepted for contract conformance)
@param {Object} _errors - Error catalog (unused; accepted for contract conformance)

@return {Object} - { loadHttpDataToInstance, buildHttpResponseObject, getHttpRequestCountryCode }
*********************************************************************/
module.exports = function loader (_lib, _config, _errors) {

  return adapter;

};///////////////////////////// Module-Loader END ///////////////////////////////


/*****************************************************************************
INTERNAL HELPERS
*****************************************************************************/

/********************************************************************
Parse a raw Cookie header string into a key/value map.
Returns empty object on empty or missing input.

@param {String} cookie_header - Raw value of the Cookie header

@return {Object} - { name: value, ... }
*********************************************************************/
function parseCookieHeader (cookie_header) {

  const result = {};

  if (!cookie_header || typeof cookie_header !== 'string') {
    return result;
  }

  const pairs = cookie_header.split(';');

  for (let i = 0; i < pairs.length; i++) {

    const pair = pairs[i].trim();
    const eq_idx = pair.indexOf('=');

    if (eq_idx < 1) {
      continue;
    }

    const key = pair.slice(0, eq_idx).trim();
    const val = pair.slice(eq_idx + 1).trim();

    if (key) {
      result[key] = decodeURIComponent(val);
    }

  }

  return result;

}


/********************************************************************
Parse a URL-encoded body string (application/x-www-form-urlencoded)
into a key/value map. Returns empty object on empty or missing input.

@param {String} body - URL-encoded body string

@return {Object} - { key: value, ... }
*********************************************************************/
function parseUrlEncodedBody (body) {

  const result = {};

  if (!body || typeof body !== 'string') {
    return result;
  }

  const params = new URLSearchParams(body);

  params.forEach(function (value, key) {
    result[key] = value;
  });

  return result;

}


/********************************************************************
Normalize all header keys to lowercase. API Gateway may deliver
headers with mixed casing depending on version and origin.

@param {Object} raw_headers - Headers object from the event

@return {Object} - New object with all keys lowercased
*********************************************************************/
function lowercaseHeaders (raw_headers) {

  if (!raw_headers || typeof raw_headers !== 'object') {
    return {};
  }

  const result = {};
  const keys = Object.keys(raw_headers);

  for (let i = 0; i < keys.length; i++) {
    result[keys[i].toLowerCase()] = raw_headers[keys[i]];
  }

  return result;

}


/********************************************************************
Parse the POST body from an API Gateway event. Detects content-type
and parses accordingly. Returns empty object when body is absent.

@param {Object} event   - Raw API Gateway event
@param {Object} headers - Lowercase headers map (already normalized)

@return {Object} - Parsed body as key/value map
*********************************************************************/
function parseBody (event, headers) {

  const raw_body = event.body;

  if (!raw_body) {
    return {};
  }

  const decoded_body = event.isBase64Encoded
    ? Buffer.from(raw_body, 'base64').toString('utf8')
    : raw_body;

  const content_type = (headers['content-type'] || '').toLowerCase();

  if (content_type.includes('application/json')) {

    try {
      const parsed = JSON.parse(decoded_body);
      return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
        ? parsed
        : {};
    }
    catch {
      return {};
    }

  }

  if (content_type.includes('application/x-www-form-urlencoded')) {
    return parseUrlEncodedBody(decoded_body);
  }

  return {};

}


/*****************************************************************************
ADAPTER OBJECT
*****************************************************************************/

const adapter = {

  /********************************************************************
  Populate instance with normalized HTTP request data from a raw
  API Gateway payload format v2.0 event (HTTP API or Lambda Function URLs).

  Populated fields:
    instance.http_request.headers  {Object} - Lowercase header key -> value map
    instance.http_request.cookies  {Object} - Parsed cookies map
    instance.http_request.get      {Object} - Query-string parameters
    instance.http_request.post     {Object} - Parsed body parameters
    instance.http_request.path     {Object} - Path parameters
    instance.http_request.method   {String} - HTTP method ('GET', 'POST', ...)
    instance.http_response         {Object} - { cookies: {} }
    instance.gateway_response_callback {Function} - Wraps the Lambda callback

  @param {Object}   instance          - Per-request instance to populate
  @param {Object}   raw_request       - Raw API Gateway v2.0 event
  @param {Object}   raw_context       - Lambda execution context (unused)
  @param {Function} response_callback - Lambda callback function(err, response)
  *********************************************************************/
  loadHttpDataToInstance: function (instance, raw_request, _raw_context, response_callback) {

    const event = raw_request || {};

    const headers = lowercaseHeaders(event.headers);

    // Cookies: v2 delivers them as event.cookies array
    const cookies = Array.isArray(event.cookies)
      ? parseCookieHeader(event.cookies.join('; '))
      : {};

    // Query string parameters
    const get_params = event.queryStringParameters || {};

    // Path parameters
    const path_params = event.pathParameters || {};

    // HTTP method: v2 nests it under requestContext.http.method
    const method = (event.requestContext &&
                    event.requestContext.http &&
                    event.requestContext.http.method)
      ? event.requestContext.http.method.toUpperCase()
      : null;

    const post_params = parseBody(event, headers);

    instance.http_request = {
      headers: headers,
      cookies: cookies,
      get    : get_params,
      post   : post_params,
      path   : path_params,
      method : method
    };

    instance.http_response = {
      cookies: {}
    };

    instance.gateway_response_callback = function (err, response) {

      if (typeof response_callback === 'function') {
        response_callback(err, response);
      }

    };

  },


  /********************************************************************
  Build the API Gateway response envelope. API Gateway expects
  { statusCode, headers, body, isBase64Encoded }.

  Body normalization rules:
    null / undefined  -> ''
    Buffer            -> base64 string (isBase64Encoded = true)
    Object            -> JSON.stringify
    Anything else     -> String(value)

  @param {Integer} status  - HTTP status code
  @param {Object}  headers - Response headers map
  @param {*}       body    - Response body (string, object, Buffer, or null)

  @return {Object} - { statusCode, headers, body, isBase64Encoded }
  *********************************************************************/
  buildHttpResponseObject: function (status, headers, body) {

    let normalized_body = '';
    let is_base64 = false;

    if (body !== null && body !== undefined) {

      if (Buffer.isBuffer(body)) {
        normalized_body = body.toString('base64');
        is_base64 = true;
      }
      else if (typeof body === 'object') {
        normalized_body = JSON.stringify(body);
      }
      else {
        normalized_body = String(body);
      }

    }

    return {
      statusCode     : status,
      headers        : headers || {},
      body           : normalized_body,
      isBase64Encoded: is_base64
    };

  },


  /********************************************************************
  Return the viewer country code if supplied by CloudFront via the
  CloudFront-Viewer-Country header (forwarded through API Gateway).
  Returns null when not present.

  @param {Object} instance - Per-request instance

  @return {String|null} - ISO 3166-1 alpha-2 country code, or null
  *********************************************************************/
  getHttpRequestCountryCode: function (instance) {

    if (instance &&
        instance.http_request &&
        instance.http_request.headers &&
        instance.http_request.headers['cloudfront-viewer-country']) {
      return instance.http_request.headers['cloudfront-viewer-country'];
    }

    return null;

  }

};
