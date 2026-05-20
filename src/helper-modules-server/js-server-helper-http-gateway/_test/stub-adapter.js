// Info: Stub adapter for js-server-helper-http-gateway tests.
// Satisfies the 3-method adapter contract with minimal fixed-output behavior
// so http-gateway.js can be tested without any real runtime (Lambda or Express).
// This is not a simulation of API Gateway or Express internals - it only
// fulfills the contract signature and returns valid-shaped dummy output.
// Each function operates on the data it is given with no side effects.
//
// Adapter contract:
//   loadHttpDataToInstance(instance, raw_request, raw_context, response_callback)
//   buildHttpResponseObject(status, headers, body)
//   getHttpRequestCountryCode(instance) -> String | null
'use strict';


/********************************************************************
Create a new stub adapter. Returns an object matching the 3-method
adapter contract consumed by http-gateway.js. Not a simulation of
any real runtime - exists only to satisfy the contract interface
and capture outbound responses for test assertions.

Each call produces an independent stub with its own `sent` array
so tests can run in isolation.

@return {Object} - { adapter, sent }
  adapter {Object} - The 3-method adapter stub
  sent    {Array}  - Array of { status, headers, body } for each response sent
*********************************************************************/
module.exports = function createStubAdapter () {

  const sent = [];

  const adapter = {

    /******************************************************************
    Populate instance with normalized HTTP request data from a plain
    raw_request object. The raw_request shape mirrors what real adapters
    produce after normalization - tests pass it pre-normalized so they
    can focus on gateway logic, not wire-format parsing.

    raw_request shape (all keys optional; defaults to empty):
      headers  {Object} - Lowercase header key -> value map
      get      {Object} - Query-string parameters
      post     {Object} - Request body parameters
      path     {Object} - Path parameters
      cookies  {Object} - Parsed cookies
      method   {String} - 'GET' | 'POST' | ...

    @param {Object}   instance          - Per-request instance to populate
    @param {Object}   raw_request       - Pre-normalized request data
    @param {Object}   raw_context       - Ignored by this adapter
    @param {Function} response_callback - Stored on instance as gateway_response_callback
    ******************************************************************/
    loadHttpDataToInstance: function (instance, raw_request, _raw_context, response_callback) {

      const req = raw_request || {};

      instance.http_request = {
        headers: req.headers || {},
        cookies: req.cookies || {},
        get    : req.get     || {},
        post   : req.post    || {},
        path   : req.path    || {},
        method : req.method  || null
      };

      instance.http_response = {
        cookies: {}
      };

      instance.gateway_response_callback = function (err, response) {

        if (typeof response_callback === 'function') {
          response_callback(err, response);
        }

        sent.push(response);

      };

    },


    /******************************************************************
    Build a response envelope. Returns a plain object that mirrors the
    shape real adapters produce, suitable for test assertions.

    @param {Integer} status  - HTTP status code
    @param {Object}  headers - Response headers map
    @param {*}       body    - Response body (string, object, or Buffer)

    @return {Object} - { status, headers, body }
    ******************************************************************/
    buildHttpResponseObject: function (status, headers, body) {

      // Normalize body to string (same rule as AWS adapter)
      let normalized_body = '';

      if (body !== null && body !== undefined) {

        if (Buffer.isBuffer(body)) {
          normalized_body = body.toString('base64');
        }
        else if (typeof body === 'object') {
          normalized_body = JSON.stringify(body);
        }
        else {
          normalized_body = String(body);
        }

      }

      return {
        status : status,
        headers: headers || {},
        body   : normalized_body
      };

    },


    /******************************************************************
    Return the viewer country code if the adapter can supply it.
    The memory adapter never has this information - returns null.

    @param {Object} _instance - Per-request instance (unused)

    @return {null}
    ******************************************************************/
    getHttpRequestCountryCode: function (_instance) {
      return null;
    }

  };


  return { adapter: adapter, sent: sent };

};
