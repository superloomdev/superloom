// Info: Locate the auth_id (or JWT in Phase 5) inside the request
// instance using a deterministic priority chain:
//   1. Authorization header with "Bearer <token>"
//   2. Custom header (e.g., X-Auth-Token) - configurable
//   3. Cookie named "{COOKIE_PREFIX}{tenant_id}"
//
// The chain is short-circuit: the first hit wins; later sources are not
// consulted. If no source has a value, returns null and the caller
// surfaces an INVALID_TOKEN error.
'use strict';


module.exports = function (Lib, Cookie) {


  ////////////////////////////// Public Methods START /////////////////////////////
  const TokenSource = {

    /********************************************************************
    Read the auth_id from the request instance using the priority chain.

    @param {Object} instance - Request instance with http_request shape
    @param {Object} args
    @param {String} args.cookie_prefix - The CONFIG.COOKIE_PREFIX value
    @param {String} args.tenant_id - Used to build the cookie name
    @param {String} [args.custom_header_name] - Optional non-standard header

    @return {String|null} - The raw auth_id value or null if not found
    *********************************************************************/
    readAuthId: function (instance, args) {

      const headers = TokenSource.getRequestHeaders(instance);

      // Priority 1: Authorization: Bearer <token>
      const bearer = TokenSource.readBearerToken(headers);
      if (bearer !== null) {
        return bearer;
      }

      // Priority 2: Custom header (when configured)
      if (
        !Lib.Utils.isNullOrUndefined(args.custom_header_name) &&
        Lib.Utils.isString(args.custom_header_name) &&
        !Lib.Utils.isEmptyString(args.custom_header_name)
      ) {

        const custom = TokenSource.readCustomHeader(headers, args.custom_header_name);
        if (custom !== null) {
          return custom;
        }

      }

      // Priority 3: Cookie
      if (
        !Lib.Utils.isNullOrUndefined(args.cookie_prefix) &&
        !Lib.Utils.isNullOrUndefined(args.tenant_id)
      ) {

        const cookie_name = Cookie.composeCookieName(args.cookie_prefix, args.tenant_id);
        const cookie_value = TokenSource.readCookie(headers, cookie_name);
        if (cookie_value !== null) {
          return cookie_value;
        }

      }

      return null;

    },


    /********************************************************************
    Read the Authorization header and extract the Bearer token.
    Returns null if absent or wrong scheme.

    @param {Object} headers - Lower-cased request headers map

    @return {String|null} - The bearer token or null
    *********************************************************************/
    readBearerToken: function (headers) {

      const auth_header = headers['authorization'];
      if (
        Lib.Utils.isNullOrUndefined(auth_header) ||
        !Lib.Utils.isString(auth_header) ||
        Lib.Utils.isEmptyString(auth_header)
      ) {
        return null;
      }

      const trimmed = auth_header.trim();

      // Expect "Bearer <token>" with case-insensitive scheme name.
      const space_index = trimmed.indexOf(' ');
      if (space_index <= 0) {
        return null;
      }

      const scheme = trimmed.slice(0, space_index).toLowerCase();
      if (scheme !== 'bearer') {
        return null;
      }

      const token = trimmed.slice(space_index + 1).trim();
      if (Lib.Utils.isEmptyString(token)) {
        return null;
      }

      return token;

    },


    /********************************************************************
    Read a custom header. Header names are matched case-insensitively
    (HTTP convention).

    @param {Object} headers - Lower-cased request headers map
    @param {String} header_name - The header to look up

    @return {String|null} - The header value or null
    *********************************************************************/
    readCustomHeader: function (headers, header_name) {

      const value = headers[header_name.toLowerCase()];
      if (
        Lib.Utils.isNullOrUndefined(value) ||
        !Lib.Utils.isString(value) ||
        Lib.Utils.isEmptyString(value)
      ) {
        return null;
      }

      return value.trim();

    },


    /********************************************************************
    Read a cookie value from the request's Cookie header.

    @param {Object} headers - Lower-cased request headers map
    @param {String} cookie_name - The cookie name to find

    @return {String|null} - The cookie value or null
    *********************************************************************/
    readCookie: function (headers, cookie_name) {

      const cookie_header = headers['cookie'];
      if (
        Lib.Utils.isNullOrUndefined(cookie_header) ||
        !Lib.Utils.isString(cookie_header) ||
        Lib.Utils.isEmptyString(cookie_header)
      ) {
        return null;
      }

      const parsed = Cookie.parseCookieHeader(cookie_header);
      const value = parsed[cookie_name];

      if (
        Lib.Utils.isNullOrUndefined(value) ||
        !Lib.Utils.isString(value) ||
        Lib.Utils.isEmptyString(value)
      ) {
        return null;
      }

      return value;

    },


    /********************************************************************
    Get the request headers from the instance, normalizing the keys
    to lower case for case-insensitive lookup.

    @param {Object} instance - Request instance

    @return {Object} - Lower-cased headers map (empty if no headers)
    *********************************************************************/
    getRequestHeaders: function (instance) {

      // Default empty map - any layer of nesting that's missing returns {}
      if (
        Lib.Utils.isNullOrUndefined(instance) ||
        Lib.Utils.isNullOrUndefined(instance.http_request) ||
        Lib.Utils.isNullOrUndefined(instance.http_request.headers)
      ) {
        return {};
      }

      // If headers are already lower-cased (most frameworks do this), pass through.
      // Otherwise, normalize.
      const raw = instance.http_request.headers;
      const result = {};
      const keys = Object.keys(raw);
      for (const key of keys) {

        result[key.toLowerCase()] = raw[key];

      }

      return result;

    }

  };//////////////////////////// Public Methods END //////////////////////////////


  return TokenSource;

};
