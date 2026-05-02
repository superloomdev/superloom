// Info: Self-contained cookie utilities. The auth module owns its own
// cookie code so it has zero dependency on a transport-level HTTP helper.
// When a project later ports js-helper-http-handler to Superloom, this
// can be revisited.
//
// Cookie name format: "{COOKIE_PREFIX}{tenant_id}"
// Reading:  parseCookieHeader(header) returns a flat name->value map.
// Writing:  setCookieOnResponse / clearCookieOnResponse stamp the
//           instance.http_response.cookies map (matches the rw-ctp
//           convention).
'use strict';


module.exports = function (Lib) {


  ////////////////////////////// Public Methods START /////////////////////////////
  const Cookie = {

    /********************************************************************
    Build the cookie name for a given (prefix, tenant_id) pair.

    @param {String} cookie_prefix - The CONFIG.COOKIE_PREFIX value
    @param {String} tenant_id - The tenant id

    @return {String} - The full cookie name
    *********************************************************************/
    composeCookieName: function (cookie_prefix, tenant_id) {

      Cookie.assertNonEmptyString(cookie_prefix, 'cookie_prefix');
      Cookie.assertNonEmptyString(tenant_id, 'tenant_id');

      return cookie_prefix + tenant_id;

    },


    /********************************************************************
    Serialize a cookie name + value + options into a single Set-Cookie
    header value.

    @param {String} name - Cookie name
    @param {String} value - Cookie value (already URL-safe)
    @param {Object} options - Cookie attributes
    @param {Integer} options.max_age - Lifetime in seconds (0 = expire now)
    @param {Boolean} [options.http_only] - HttpOnly flag (default true)
    @param {Boolean} [options.secure] - Secure flag (default true)
    @param {String}  [options.same_site] - 'lax' | 'strict' | 'none' (default 'lax')
    @param {String}  [options.path] - Path scope (default '/')
    @param {String}  [options.domain] - Domain scope (default unset)

    @return {String} - Set-Cookie header value
    *********************************************************************/
    serializeCookie: function (name, value, options) {

      Cookie.assertNonEmptyString(name, 'cookie name');

      // Per RFC 6265, the Set-Cookie header is a sequence of attribute
      // segments separated by '; '. We never URL-encode the value here -
      // the auth_id wire format is already URL-safe (alphanumeric + '-').
      const parts = [name + '=' + value];

      if (Lib.Utils.isInteger(options.max_age)) {
        parts.push('Max-Age=' + options.max_age);
      }

      // Path defaults to '/' so the cookie is sent on every request
      const path = Lib.Utils.fallback(options.path, '/');
      parts.push('Path=' + path);

      // Domain is intentionally unset by default - the browser will
      // restrict the cookie to the exact host that issued it. Projects
      // can opt in to a wider scope by passing options.domain explicitly.
      if (
        !Lib.Utils.isNullOrUndefined(options.domain) &&
        Lib.Utils.isString(options.domain) &&
        !Lib.Utils.isEmptyString(options.domain)
      ) {
        parts.push('Domain=' + options.domain);
      }

      // HttpOnly defaults to true (cookie inaccessible from JavaScript)
      if (Lib.Utils.fallback(options.http_only, true) === true) {
        parts.push('HttpOnly');
      }

      // Secure defaults to true (cookie only sent over HTTPS)
      if (Lib.Utils.fallback(options.secure, true) === true) {
        parts.push('Secure');
      }

      // SameSite defaults to 'lax' (sent on top-level navigations + same-site).
      // 'none' requires Secure; 'strict' is rarely what auth wants.
      const same_site = Lib.Utils.fallback(options.same_site, 'lax');
      if (
        same_site === 'lax' ||
        same_site === 'strict' ||
        same_site === 'none'
      ) {
        parts.push('SameSite=' + same_site.charAt(0).toUpperCase() + same_site.slice(1));
      }

      return parts.join('; ');

    },


    /********************************************************************
    Parse an inbound Cookie request header into a name->value map.
    Tolerates leading/trailing whitespace around values.

    @param {String} header - The Cookie request header value

    @return {Object} - Map of cookie name to cookie value
    *********************************************************************/
    parseCookieHeader: function (header) {

      const result = {};

      if (
        Lib.Utils.isNullOrUndefined(header) ||
        !Lib.Utils.isString(header) ||
        Lib.Utils.isEmptyString(header)
      ) {
        return result;
      }

      // Cookies are separated by ';' (with optional whitespace).
      const segments = header.split(';');
      for (const segment of segments) {

        // Each segment is "name=value" - we split on the first '=' only
        // so values containing '=' (like base64) are preserved.
        const eq_index = segment.indexOf('=');
        if (eq_index <= 0) {
          continue;
        }

        const name = segment.slice(0, eq_index).trim();
        const value = segment.slice(eq_index + 1).trim();

        if (Lib.Utils.isEmptyString(name)) {
          continue;
        }

        result[name] = value;

      }

      return result;

    },


    /********************************************************************
    Stamp a Set-Cookie header onto the request instance's response.
    The instance is expected to have an `http_response.cookies` map -
    this matches the structure used by Superloom's interfaces and the
    rw-ctp js-helper-http-handler convention.

    @param {Object} instance - Request instance
    @param {String} name - Cookie name
    @param {String} value - Cookie value
    @param {Object} options - Cookie attributes (see serializeCookie)

    @return {void}
    *********************************************************************/
    setCookieOnResponse: function (instance, name, value, options) {

      Cookie.ensureResponseCookieMap(instance);
      instance.http_response.cookies[name] = Cookie.serializeCookie(name, value, options);

    },


    /********************************************************************
    Stamp a Set-Cookie header that immediately expires the named cookie.
    Browsers honor Max-Age=0 by deleting the cookie.

    @param {Object} instance - Request instance
    @param {String} name - Cookie name
    @param {Object} [options] - Cookie attributes (path/domain must match
                                the original cookie or it won't be deleted)

    @return {void}
    *********************************************************************/
    clearCookieOnResponse: function (instance, name, options) {

      const clear_options = Object.assign({}, options || {}, { max_age: 0 });
      Cookie.setCookieOnResponse(instance, name, '', clear_options);

    }

  };//////////////////////////// Public Methods END //////////////////////////////


  ////////////////////////////// Helper Methods START /////////////////////////////

  /********************************************************************
  Ensure instance.http_response.cookies exists. Creates the path
  lazily so callers don't have to bootstrap it.

  @param {Object} instance - Request instance

  @return {void}
  *********************************************************************/
  Cookie.ensureResponseCookieMap = function (instance) {

    if (Lib.Utils.isNullOrUndefined(instance.http_response)) {
      instance.http_response = {};
    }

    if (Lib.Utils.isNullOrUndefined(instance.http_response.cookies)) {
      instance.http_response.cookies = {};
    }

  };


  /********************************************************************
  Throw TypeError if the value isn't a non-empty string.

  @param {*} value - Value to check
  @param {String} name - Field name

  @return {void}
  *********************************************************************/
  Cookie.assertNonEmptyString = function (value, name) {

    if (
      Lib.Utils.isNullOrUndefined(value) ||
      !Lib.Utils.isString(value) ||
      Lib.Utils.isEmptyString(value)
    ) {
      throw new TypeError('[js-server-helper-auth] cookie ' + name + ' must be a non-empty string');
    }

  };

  ///////////////////////////// Helper Methods END ////////////////////////////////


  return Cookie;

};
