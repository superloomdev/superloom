// Info: Locate the auth_id (or JWT in Phase 5) inside the request
// instance using a deterministic priority chain:
//   1. Authorization header with "Bearer <token>"
//   2. Custom header (e.g., X-Auth-Token) - configurable
//   3. Cookie named "{COOKIE_PREFIX}{tenant_id}"
//
// The chain is short-circuit: the first hit wins; later sources are not
// consulted. If no source has a value, returns null and the caller
// surfaces an INVALID_TOKEN error.
//
// TODO (temporary exception): cookie utilities live in parts/cookie.js.
// TokenSource self-requires that part so every parts factory has the
// uniform `(Lib, CONFIG, ERRORS)` signature. Once Lib.HTTP ships and
// absorbs cookie parsing, this self-require + the cookie part go away.
'use strict';

const cookieFactory = require('./cookie');


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. Builds the Cookie part this TokenSource depends on
(temporary self-require - see top-of-file TODO) and hands it to
createInterface alongside the standard parts-factory triple.

@param {Object} Lib - Dependency container (Utils)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog for this module

@return {Object} - Public TokenSource interface
*********************************************************************/
module.exports = function loader (Lib, CONFIG, ERRORS) {

  // Temporary self-require of the cookie part. Lib.HTTP will absorb
  // cookie parsing in a future pass, at which point this self-require
  // and the cookie part go away.
  const Cookie = cookieFactory(Lib, CONFIG, ERRORS);

  return createInterface(Lib, CONFIG, ERRORS, Cookie);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Build the public TokenSource interface. Closes over the Cookie part
so readAuthId can call into composeCookieName / parseCookieHeader
without re-constructing them on every call.

@param {Object} Lib - Dependency container (Utils)
@param {Object} CONFIG - Merged module configuration (unused here)
@param {Object} ERRORS - Error catalog for this module (unused here)
@param {Object} Cookie - Constructed Cookie part

@return {Object} - Public TokenSource interface
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, Cookie) {


  ///////////////////////////Public Functions START//////////////////////////////
  const TokenSource = {

    /********************************************************************
    Read the auth_id from the request instance using the priority chain.

    @param {Object} instance - Request instance with http_request shape
    @param {Object} options
    @param {String} options.cookie_prefix - The CONFIG.COOKIE_PREFIX value
    @param {String} options.tenant_id - Used to build the cookie name
    @param {String} [options.custom_header_name] - Optional non-standard header

    @return {String|null} - The raw auth_id value or null if not found
    *********************************************************************/
    readAuthId: function (instance, options) {

      // Normalize request headers once before consulting each source in order
      const headers = TokenSource.getRequestHeaders(instance);

      // Priority 1: Authorization: Bearer <token>
      const bearer = TokenSource.readBearerToken(headers);
      if (bearer !== null) {
        return bearer;
      }

      // Priority 2: Custom header (when configured)
      if (
        !Lib.Utils.isNullOrUndefined(options.custom_header_name) &&
        Lib.Utils.isString(options.custom_header_name) &&
        !Lib.Utils.isEmptyString(options.custom_header_name)
      ) {

        const custom = TokenSource.readCustomHeader(headers, options.custom_header_name);
        if (custom !== null) {
          return custom;
        }

      }

      // Priority 3: Cookie
      if (
        !Lib.Utils.isNullOrUndefined(options.cookie_prefix) &&
        !Lib.Utils.isNullOrUndefined(options.tenant_id)
      ) {

        const cookie_name = Cookie.composeCookieName(options.cookie_prefix, options.tenant_id);
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

      // Return null early if the Authorization header is absent or empty
      const auth_header = headers['authorization'];
      if (
        Lib.Utils.isNullOrUndefined(auth_header) ||
        !Lib.Utils.isString(auth_header) ||
        Lib.Utils.isEmptyString(auth_header)
      ) {
        return null;
      }

      // Trim whitespace and locate the scheme/token boundary
      const trimmed = auth_header.trim();

      // Expect "Bearer <token>" with case-insensitive scheme name
      const space_index = trimmed.indexOf(' ');
      if (space_index <= 0) {
        return null;
      }

      // Reject if scheme is anything other than 'bearer'
      const scheme = trimmed.slice(0, space_index).toLowerCase();
      if (scheme !== 'bearer') {
        return null;
      }

      // Return the token value, or null if it came out empty after trimming
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

      // Look up the header case-insensitively; return null if absent or empty
      const value = headers[header_name.toLowerCase()];
      if (
        Lib.Utils.isNullOrUndefined(value) ||
        !Lib.Utils.isString(value) ||
        Lib.Utils.isEmptyString(value)
      ) {
        return null;
      }

      // Return the trimmed header value
      return value.trim();

    },


    /********************************************************************
    Read a cookie value from the request's Cookie header.

    @param {Object} headers - Lower-cased request headers map
    @param {String} cookie_name - The cookie name to find

    @return {String|null} - The cookie value or null
    *********************************************************************/
    readCookie: function (headers, cookie_name) {

      // Return null early if the Cookie header is absent or empty
      const cookie_header = headers['cookie'];
      if (
        Lib.Utils.isNullOrUndefined(cookie_header) ||
        !Lib.Utils.isString(cookie_header) ||
        Lib.Utils.isEmptyString(cookie_header)
      ) {
        return null;
      }

      // Parse the header and look up the target cookie by name
      const parsed = Cookie.parseCookieHeader(cookie_header);
      const value = parsed[cookie_name];

      // Return null if the cookie is absent or came out as an empty string
      if (
        Lib.Utils.isNullOrUndefined(value) ||
        !Lib.Utils.isString(value) ||
        Lib.Utils.isEmptyString(value)
      ) {
        return null;
      }

      // Return the matched cookie value
      return value;

    },


    /********************************************************************
    Get the request headers from the instance, normalizing the keys
    to lower case for case-insensitive lookup.

    @param {Object} instance - Request instance

    @return {Object} - Lower-cased headers map (empty if no headers)
    *********************************************************************/
    getRequestHeaders: function (instance) {

      // Return an empty map if any layer of the request path is missing
      if (
        Lib.Utils.isNullOrUndefined(instance) ||
        Lib.Utils.isNullOrUndefined(instance.http_request) ||
        Lib.Utils.isNullOrUndefined(instance.http_request.headers)
      ) {
        return {};
      }

      // Normalize all header keys to lower case for case-insensitive lookup
      const raw = instance.http_request.headers;
      const result = {};
      const keys = Object.keys(raw);
      for (const key of keys) {

        result[key.toLowerCase()] = raw[key];

      }

      // Return the normalized headers map
      return result;

    }

  };///////////////////////////Public Functions END////////////////////////////////


  return TokenSource;

};/////////////////////////// createInterface END ////////////////////////////////

