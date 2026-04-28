// Info: Outgoing HTTP client for Node.js. Native `fetch` wrapper with auth support and normalized response shape.
// Server-only: uses Node.js 22+ built-in `fetch`, `AbortSignal.timeout`, `URL`, `URLSearchParams`, `Buffer`. No runtime dependencies.
//
// Factory pattern: each loader call returns an independent Http interface
// with its own Lib and CONFIG. Stateless - no per-instance resources.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib and CONFIG.

@param {Object} shared_libs - Lib container with Utils and Debug
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./http.config'),
    config || {}
  );

  // Create and return the public interface
  return createInterface(Lib, CONFIG);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib and CONFIG.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged configuration for this instance

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG) {

  ///////////////////////////Public Functions START//////////////////////////////
  const Http = {

    /********************************************************************
    Send HTTP request and return normalized JSON response.
    Supports GET, POST, PUT, DELETE, PATCH with various content types.

    @param {String} url - Full URL (with protocol)
    @param {String} method - HTTP method ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')
    @param {Object} [params] - (Optional) Request parameters (query for GET/DELETE, body for POST/PUT/PATCH)
    @param {String} [content_type] - (Optional) 'json' | 'urlencoded' | 'multipart'. Default: 'urlencoded'
    @param {Object} [options] - (Optional) Additional options
    @param {Integer} [options.timeout] - Override default timeout (seconds)
    @param {Object} [options.headers] - Additional headers to send
    @param {Object} [options.auth] - Authentication data
    @param {String} [options.auth.bearer_token] - Bearer token for authorization
    @param {Object} [options.auth.basic] - Basic auth credentials { username, password }

    @return {Promise<Object>} - Normalized response object
    @return {Boolean} .success - true if request succeeded (2xx status)
    @return {Integer} .status - HTTP response code (0 for network errors)
    @return {Object} .headers - Response headers (lowercase keys)
    @return {Object|String|null} .data - Response body (parsed JSON or raw text)
    @return {Object|null} .error - Error details if success is false
    *********************************************************************/
    fetchJSON: async function (url, method, params, content_type, options) {

      options = options || {};

      return await _Http.fetch(
        url,
        method,
        params,
        content_type,
        options.timeout,
        options.headers,
        options.auth
      );

    },


    /********************************************************************
    Send HTTP GET request and return normalized JSON response.

    @param {String} url - Full URL
    @param {Object} [params] - (Optional) Query parameters
    @param {Object} [options] - (Optional) Request options (timeout, headers, auth)

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    get: async function (url, params, options) {

      return await Http.fetchJSON(url, 'GET', params, 'urlencoded', options);

    },


    /********************************************************************
    Send HTTP POST request with JSON body.

    @param {String} url - Full URL
    @param {Object} [params] - (Optional) Request body
    @param {Object} [options] - (Optional) Request options (timeout, headers, auth)

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    post: async function (url, params, options) {

      return await Http.fetchJSON(url, 'POST', params, 'json', options);

    },


    /********************************************************************
    Send HTTP POST request with url-encoded body.

    @param {String} url - Full URL
    @param {Object} [params] - (Optional) Request body
    @param {Object} [options] - (Optional) Request options (timeout, headers, auth)

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    postForm: async function (url, params, options) {

      return await Http.fetchJSON(url, 'POST', params, 'urlencoded', options);

    },


    /********************************************************************
    Send HTTP PUT request with JSON body.

    @param {String} url - Full URL
    @param {Object} [params] - (Optional) Request body
    @param {Object} [options] - (Optional) Request options (timeout, headers, auth)

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    put: async function (url, params, options) {

      return await Http.fetchJSON(url, 'PUT', params, 'json', options);

    },


    /********************************************************************
    Send HTTP DELETE request.

    @param {String} url - Full URL
    @param {Object} [params] - (Optional) Query parameters
    @param {Object} [options] - (Optional) Request options (timeout, headers, auth)

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    delete: async function (url, params, options) {

      return await Http.fetchJSON(url, 'DELETE', params, 'urlencoded', options);

    },


    /********************************************************************
    Send HTTP PATCH request with JSON body.

    @param {String} url - Full URL
    @param {Object} [params] - (Optional) Request body
    @param {Object} [options] - (Optional) Request options (timeout, headers, auth)

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    patch: async function (url, params, options) {

      return await Http.fetchJSON(url, 'PATCH', params, 'json', options);

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _Http = {

    /********************************************************************
    Internal fetch implementation using Node.js built-in global `fetch`.

    @param {String} url - Full URL
    @param {String} method - HTTP method
    @param {Object} params - Request parameters
    @param {String} content_type - 'json' | 'urlencoded' | 'multipart'
    @param {Integer} timeout - Override timeout (seconds)
    @param {Object} headers - Additional headers
    @param {Object} auth - Authentication data { bearer_token } or { basic: { username, password } }

    @return {Promise<Object>} - { success, status, headers, data, error }
    *********************************************************************/
    fetch: async function (url, method, params, content_type, timeout, headers, auth) {

      // Start performance timer
      const start_ms = Date.now();

      // Build headers with framework defaults (caller overrides below)
      const request_headers = {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': CONFIG.USER_AGENT
      };

      // Determine effective timeout in milliseconds
      const timeout_ms = (timeout || CONFIG.TIMEOUT) * 1000;

      // Apply authentication headers
      if (auth && !Lib.Utils.isEmpty(auth.bearer_token)) {
        request_headers['Authorization'] = 'Bearer ' + auth.bearer_token;
      }
      else if (auth && auth.basic && !Lib.Utils.isEmpty(auth.basic.username)) {
        const credentials = auth.basic.username + ':' + (auth.basic.password || '');
        request_headers['Authorization'] = 'Basic ' + Buffer.from(credentials).toString('base64');
      }

      // Build final URL and body depending on method + content type
      let final_url = url;
      let body;

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {

        // Body-bearing methods: encode payload per content type
        const encoded = _Http.encodeBody(params, content_type);
        body = encoded.body;

        if (encoded.content_type_header) {
          request_headers['Content-Type'] = encoded.content_type_header;
        }

      }
      else {

        // Query-string methods: append params to URL
        final_url = _Http.appendQueryParams(url, params);

      }

      // Apply caller-supplied headers last so they override defaults
      if (headers && typeof headers === 'object') {
        Object.assign(request_headers, headers);
      }

      // Build fetch init object
      const init = {
        method: method,
        headers: request_headers,
        signal: AbortSignal.timeout(timeout_ms),
        redirect: 'follow'
      };

      if (body !== undefined) {
        init.body = body;
      }

      // Log outgoing request
      Lib.Debug.log('HTTP Request', { url: final_url, method: method });

      // Execute request and normalize result
      try {

        const response = await fetch(final_url, init);

        // Read body and attempt JSON parse (falls back to raw text)
        const data = await _Http.readResponseBody(response);

        // Log performance of completed request
        Lib.Debug.performanceAuditLog('HTTP ' + method, final_url, start_ms);

        // HTTP-level success vs error (4xx/5xx is not a thrown exception)
        if (response.ok) {

          return {
            success: true,
            status: response.status,
            headers: _Http.headersToObject(response.headers),
            data: data,
            error: null
          };

        }

        return {
          success: false,
          status: response.status,
          headers: _Http.headersToObject(response.headers),
          data: data,
          error: {
            type: 'HTTP_ERROR',
            message: 'HTTP ' + response.status
          }
        };

      }
      catch (error) {

        // Log performance of failed request
        Lib.Debug.performanceAuditLog('HTTP ' + method + ' (failed)', final_url, start_ms);

        // Timeout from AbortSignal.timeout()
        if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {

          return {
            success: false,
            status: 0,
            headers: {},
            data: null,
            error: {
              type: 'NETWORK_ERROR',
              message: 'Request timed out after ' + timeout_ms + 'ms'
            }
          };

        }

        // Network failures (DNS, connection refused, TLS errors) surface as TypeError
        if (error instanceof TypeError) {

          return {
            success: false,
            status: 0,
            headers: {},
            data: null,
            error: {
              type: 'NETWORK_ERROR',
              message: error.message || 'Network request failed'
            }
          };

        }

        // Unknown request setup error
        Lib.Debug.log('HTTP Setup Error', error.message);

        return {
          success: false,
          status: 0,
          headers: {},
          data: null,
          error: {
            type: 'REQUEST_ERROR',
            message: error.message || 'Request setup failed'
          }
        };

      }

    },


    /********************************************************************
    Encode request body according to content type.

    @param {Object|FormData} params - Payload
    @param {String} content_type - 'json' | 'urlencoded' | 'multipart'

    @return {Object} - { body, content_type_header }
    *********************************************************************/
    encodeBody: function (params, content_type) {

      // JSON body
      if (content_type === 'json') {

        return {
          body: params !== undefined && params !== null ? JSON.stringify(params) : undefined,
          content_type_header: 'application/json'
        };

      }

      // Multipart body: caller passes a FormData instance; fetch sets the boundary automatically
      if (content_type === 'multipart') {

        return {
          body: params,
          content_type_header: null
        };

      }

      // Default: urlencoded body
      const encoded = params ? new URLSearchParams(params).toString() : undefined;

      return {
        body: encoded,
        content_type_header: 'application/x-www-form-urlencoded'
      };

    },


    /********************************************************************
    Append query string parameters to a URL.

    @param {String} url - Base URL
    @param {Object} params - Query parameters

    @return {String} - URL with query string appended
    *********************************************************************/
    appendQueryParams: function (url, params) {

      if (!params || typeof params !== 'object') {
        return url;
      }

      // Append params, preserving any existing query string on the URL
      const url_obj = new URL(url);

      Object.keys(params).forEach(function (key) {
        if (!Lib.Utils.isNullOrUndefined(params[key])) {
          url_obj.searchParams.append(key, params[key]);
        }
      });

      return url_obj.toString();

    },


    /********************************************************************
    Read response body: try JSON first, fall back to raw text. Empty body returns null.

    @param {Response} response - Fetch Response object

    @return {Promise<Object|String|null>} - Parsed JSON, raw text, or null
    *********************************************************************/
    readResponseBody: async function (response) {

      // Empty body (e.g., 204 No Content)
      const text = await response.text();

      if (text.length === 0) {
        return null;
      }

      // Try JSON parse; fall back to raw text on parse failure
      try {
        return JSON.parse(text);
      }
      catch {
        return text;
      }

    },


    /********************************************************************
    Convert Headers instance to a plain object with lowercase keys.

    @param {Headers} headers - Fetch Headers instance

    @return {Object} - Headers as plain object (lowercase keys)
    *********************************************************************/
    headersToObject: function (headers) {

      const normalized = {};

      if (headers && typeof headers.forEach === 'function') {
        headers.forEach(function (value, key) {
          normalized[key.toLowerCase()] = value;
        });
      }

      return normalized;

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return Http;

};/////////////////////////// createInterface END ///////////////////////////////
