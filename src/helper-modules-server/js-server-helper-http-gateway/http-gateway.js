// Info: Incoming HTTP gateway for Node.js. Normalizes raw runtime request
// data into a per-request instance object and writes responses back through
// the runtime-specific adapter (API Gateway, Express, ...).
//
// Factory pattern: each loader call returns an independent HttpGateway
// interface bound to one adapter. Stateless - no per-instance resources.
//
// Multipart/form-data is NOT supported. Use application/json or
// application/x-www-form-urlencoded for POST bodies.
//
// Runtime adapters are provided by standalone adapter packages. The caller
// passes the chosen adapter factory directly as CONFIG.ADAPTER:
//   js-server-helper-http-gateway-adapter-aws-apigateway
//   js-server-helper-http-gateway-adapter-express
//
// Adapter contract (3 methods every adapter must implement):
//   loadHttpDataToInstance(instance, raw_request, raw_context, response_callback)
//   buildHttpResponseObject(status, headers, body)
//   getHttpRequestCountryCode(instance)  -> String | null
//
// Compatibility: Node.js 24+
'use strict';


// Known HTTP status codes for returnHttpStatusToGateway
const STATUS_CODES = Object.freeze({
  not_modified : 304,
  bad_request  : 400,
  unauthorized : 401,
  not_found    : 404,
  invalid_token: 498
});


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent HttpGateway instance
bound to one adapter. Validates CONFIG at construction time so
misconfiguration fails at startup, not on first request.

@param {Object} shared_libs - Lib container with Utils, Debug, Instance
@param {Object} config      - Overrides merged over module config defaults

@return {Object} - Public HttpGateway interface
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Instance: shared_libs.Instance
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./http-gateway.config'),
    config || {}
  );

  // Internal error catalog
  const ERRORS = require('./http-gateway.errors');

  // Validate CONFIG early - throws on misconfiguration
  const Validators = require('./http-gateway.validators')(Lib);
  Validators.validateConfig(CONFIG);

  // Instantiate the adapter. CONFIG.ADAPTER is the factory function passed
  // in by the caller; it extracts its own slice from CONFIG.ADAPTER_CONFIG.
  const adapter = CONFIG.ADAPTER(Lib, CONFIG, ERRORS);

  // Construct internal parts. All parts use the uniform (Lib, CONFIG, ERRORS)
  // signature; unused args are accepted for future extensibility.
  const Parts = {
    Cookies: require('./parts/cookies')(Lib, CONFIG, ERRORS),
    UrlParts: require('./parts/url-parts')(Lib, CONFIG, ERRORS),
    Params: require('./parts/params')(Lib, CONFIG, ERRORS)
  };

  return createInterface(Lib, CONFIG, ERRORS, Parts, adapter);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Build the public HttpGateway interface closed over Lib, CONFIG,
ERRORS, Parts, and adapter.

@param {Object} Lib     - Dependency container
@param {Object} CONFIG  - Merged configuration
@param {Object} ERRORS  - Error catalog
@param {Object} Parts   - Instantiated parts (Cookies, UrlParts, Params)
@param {Object} adapter - Instantiated adapter (3-method contract)

@return {Object} - Public HttpGateway interface
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, Parts, adapter) {


  ///////////////////////////Public Functions START//////////////////////////////
  const HttpGateway = {

    /********************************************************************
    Initialize HTTP request data in instance from raw runtime data.
    Delegates to the configured adapter which normalizes the wire-format
    into instance.http_request, instance.http_response, and
    instance.gateway_response_callback.

    @param {Object}   instance          - Per-request instance to populate
    @param {Object}   raw_request       - Raw request from runtime (event / req)
    @param {Object}   raw_context       - Runtime execution context (ctx / null)
    @param {Function} response_callback - Runtime response callback (cb / res)

    @return {void}
    *********************************************************************/
    initHttpRequestData: function (instance, raw_request, raw_context, response_callback) {

      adapter.loadHttpDataToInstance(instance, raw_request, raw_context, response_callback);

    },


    /********************************************************************
    Return true if the instance was initialized with HTTP request data.

    @param {Object} instance - Per-request instance

    @return {Boolean}
    *********************************************************************/
    isHttpInstance: function (instance) {

      return (
        !Lib.Utils.isNullOrUndefined(instance.http_request) &&
        instance.http_request !== false
      );

    },


    /********************************************************************
    Build a typed, validated args object from the normalized HTTP request
    data in instance.http_request. See parts/params.js for the full param
    descriptor shape.

    @param {Object}   instance - Per-request instance with http_request populated
    @param {Object[]} params   - Array of parameter descriptor objects

    @return {Array} [null, {Object}]  - On success
    @return {Array} [null, false]     - On required-param or validation failure
    @return {Array} [{Object}, false] - On invalidate_func failure
    *********************************************************************/
    setArgsFromRequest: function (instance, params) {

      return Parts.Params.setArgsFromRequest(instance, params);

    },


    /********************************************************************
    Send an HTTP response back through the runtime callback.
    Merges default headers (Cache-Control, Content-Type) with any cookies
    set on instance.http_response.cookies, then adds caller-supplied headers.

    @param {Object}  instance         - Per-request instance
    @param {Integer} status           - HTTP status code
    @param {Object}  [headers]        - Optional additional response headers
    @param {Object}  [body]           - Optional response body

    @return {Boolean} - Always true
    *********************************************************************/
    returnHttpResponse: function (instance, status, headers, body) {

      // Default headers
      const final_headers = {
        'Cache-Control': 'max-age=0',
        'Content-Type': 'application/json'
      };

      // Merge any Set-Cookie values attached to the instance
      if (Object.keys(instance.http_response.cookies).length > 0) {
        Object.assign(final_headers, instance.http_response.cookies);
      }

      // Merge caller-supplied headers last (they win over defaults)
      if (!Lib.Utils.isNullOrUndefined(headers)) {
        Object.assign(final_headers, headers);
      }

      const response = adapter.buildHttpResponseObject(status, final_headers, body);

      instance.gateway_response_callback(null, response);

      return true;

    },


    /********************************************************************
    Send a body-less HTTP status response back through the runtime callback.

    @param {Object} instance     - Per-request instance
    @param {String} status_name  - One of: 'not_modified' | 'bad_request' |
                                   'unauthorized' | 'not_found' | 'invalid_token'

    @return {Boolean} - Always true
    *********************************************************************/
    returnHttpStatus: function (instance, status_name) {

      return HttpGateway.returnHttpResponse(instance, STATUS_CODES[status_name]);

    },


    /********************************************************************
    Send a 301 permanent redirect response back through the runtime callback.

    @param {Object} instance  - Per-request instance
    @param {String} location  - Redirect target URI

    @return {Boolean} - Always true
    *********************************************************************/
    returnHttpRedirect: function (instance, location) {

      return HttpGateway.returnHttpResponse(
        instance,
        301,
        { 'Location': location }
      );

    },


    /********************************************************************
    Send a 301 redirect to '/404' back through the runtime callback.

    @param {Object} instance - Per-request instance

    @return {Boolean} - Always true
    *********************************************************************/
    returnHttpRedirect404: function (instance) {

      return HttpGateway.returnHttpRedirect(instance, '/404');

    },


    /********************************************************************
    Get the client IP address from the request headers.
    Uses the x-forwarded-for header; returns the first IP in the chain
    (the originating client address).

    @param {Object} instance - Per-request instance

    @return {String} - IP address string, or '' if not available
    *********************************************************************/
    getRequestIPAddress: function (instance) {

      if ('x-forwarded-for' in instance.http_request.headers) {
        return instance.http_request.headers['x-forwarded-for'].split(',', 1)[0].trim();
      }

      return '';

    },


    /********************************************************************
    Get the User-Agent string from the request headers.

    @param {Object} instance - Per-request instance

    @return {String} - User-Agent string, or '' if not present
    *********************************************************************/
    getRequestUserAgent: function (instance) {

      if ('user-agent' in instance.http_request.headers) {
        return instance.http_request.headers['user-agent'];
      }

      return '';

    },


    /********************************************************************
    Get the Origin header from the request.
    Returns the scheme + host (e.g. 'https://api.example.com').

    @param {Object} instance - Per-request instance

    @return {String} - Origin string, or '' if not present
    *********************************************************************/
    getRequestOrigin: function (instance) {

      if ('origin' in instance.http_request.headers) {
        return instance.http_request.headers['origin'];
      }

      return '';

    },


    /********************************************************************
    Get the viewer country code from the request.
    Availability depends on the adapter - adapters that cannot supply
    this (e.g. Express without a CDN) return null.

    @param {Object} instance - Per-request instance

    @return {String|null} - ISO 3166-1 alpha-2 country code, or null
    *********************************************************************/
    getRequestCountryCode: function (instance) {

      return adapter.getHttpRequestCountryCode(instance);

    },


    /********************************************************************
    Set a cookie on the HTTP response. The serialized Set-Cookie string
    is stored in instance.http_response.cookies and flushed by
    returnHttpResponse when the response is sent.

    SameSite=None is omitted for browsers known to mishandle it
    (iOS 12, macOS 10.14 Safari, UC Browser < 12.13.2, Chromium 51-66).

    @param {Object} instance     - Per-request instance
    @param {String} cookie_name  - Cookie name
    @param {String} cookie_value - Cookie value
    @param {Number} cookie_life  - Lifetime in seconds (maxAge)

    @return {void}
    *********************************************************************/
    setCookie: function (instance, cookie_name, cookie_value, cookie_life) {

      const options = Parts.Cookies.buildCookieOptions(cookie_life);

      const ua = HttpGateway.getRequestUserAgent(instance);

      if (!Parts.Cookies.isSameSiteNoneIncompatible(ua)) {
        options.sameSite = 'none';
      }

      instance.http_response.cookies['Set-Cookie'] = Parts.Cookies.serialize(
        cookie_name,
        cookie_value,
        options
      );

    },


    /********************************************************************
    Format a Unix timestamp (seconds) as an HTTP-date string.
    If no date is provided the current time is used.

    Format: "Day, DD Mon YYYY HH:MM:SS GMT"
    Example: "Wed, 21 Oct 2015 07:28:00 GMT"

    @param {Number} [timestamp_seconds] - Unix timestamp (seconds). Optional.

    @return {String} - HTTP-date formatted string
    *********************************************************************/
    getHttpTime: function (timestamp_seconds) {

      if (!Lib.Utils.isNullOrUndefined(timestamp_seconds)) {
        return new Date(timestamp_seconds * 1000).toUTCString();
      }

      return new Date().toUTCString();

    },


    /********************************************************************
    Extract the component parts of a URL.

    @param {String} url - Full URL string to parse

    @return {Object} - { sub_domain, domain, domain_without_tld, tld,
                         hostname, is_ip }
    *********************************************************************/
    getUrlParts: function (url) {

      return Parts.UrlParts.getUrlParts(url);

    }

  };
  ////////////////////////////Public Functions END//////////////////////////////


  return HttpGateway;

};
/////////////////////////// createInterface END ////////////////////////////////
