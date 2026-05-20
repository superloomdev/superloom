// Info: Cookie utilities for js-server-helper-http-gateway.
//
// Cookie serialization and parsing delegate to the `cookie` npm package
// (jshttp). Cookie handling has well-known security and correctness
// pitfalls — encoding edge cases, prototype-pollution via headers,
// RFC 6265 attribute grammar — that a purpose-built library handles
// reliably. We own only the SameSite=None browser-quirk detection
// below: it is a product decision, not a spec concern, so it stays
// in-house.
//
// Singleton: all methods are pure string operations with no per-caller
// state or config. Node.js require cache guarantees the same Cookies
// object is returned on every subsequent require. No factory needed.
//
// SameSite=None incompatibility reference:
//   https://www.chromium.org/updates/same-site/incompatible-clients
'use strict';


// Third-party cookie string codec (RFC 6265, jshttp/cookie)
const CookieLib = require('cookie');

// Shared dependencies injected by loader (uniform parts signature)
let Lib; // eslint-disable-line no-unused-vars
let CONFIG; // eslint-disable-line no-unused-vars
let ERRORS; // eslint-disable-line no-unused-vars


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib, CONFIG, and ERRORS and returns the
module-scope Cookies object directly. All three are accepted for
signature uniformity with other parts — none are consumed today.

@param {Object} shared_libs - Dependency container (Utils, Debug)
@param {Object} config      - Merged module configuration
@param {Object} errors      - Module error catalog

@return {Object} - Public Cookies interface
*********************************************************************/
module.exports = function loader (shared_libs, config, errors) {

  // Assign to module-scope vars so public and private objects can close over them
  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;

  return Cookies;

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const Cookies = {

  /********************************************************************
  Serialize one cookie into a Set-Cookie header string.
  Delegates to cookie.stringifySetCookie (jshttp). The library handles
  RFC 6265 name/value grammar, percent-encoding of unsafe value
  characters, and all attribute formatting.

  @param {String} name    - Cookie name
  @param {String} value   - Cookie value
  @param {Object} options - Cookie attributes
  @param {Number}  [options.maxAge]   - Lifetime in seconds
  @param {Boolean} [options.httpOnly] - HttpOnly flag
  @param {Boolean} [options.secure]   - Secure flag
  @param {String}  [options.sameSite] - 'lax' | 'strict' | 'none'
  @param {String}  [options.path]     - Path scope
  @param {String}  [options.domain]   - Domain scope

  @return {String} - Serialized Set-Cookie string
  *********************************************************************/
  serialize: function (name, value, options) {

    return CookieLib.stringifySetCookie(name, value, options);

  },


  /********************************************************************
  Parse a Cookie request header string into a name->value map.
  Delegates to cookie.parseCookie (jshttp). The library handles percent-
  decoding (with graceful fallback on malformed sequences) and uses a
  null-prototype result map to defeat prototype-pollution attacks via
  headers like "__proto__=...".

  @param {String} header - Raw Cookie header value

  @return {Object} - Flat name->value map (null-prototype)
  *********************************************************************/
  parse: function (header) {

    if (!header || typeof header !== 'string') {
      return Object.create(null);
    }

    return CookieLib.parseCookie(header);

  },


  /********************************************************************
  Build the default options object for a session cookie.
  Caller may extend or override individual keys after calling this.

  @param {Number} max_age_seconds - Seconds until the cookie expires

  @return {Object} - Cookie options suitable for serialize()
  *********************************************************************/
  buildCookieOptions: function (max_age_seconds) {

    return {
      httpOnly: false,
      secure: true,
      maxAge: max_age_seconds,
      path: '/'
    };

  },


  /********************************************************************
  Return true if the user-agent string belongs to a browser that does
  NOT support SameSite=None correctly. Callers should omit the
  sameSite attribute entirely for these browsers.

  Affected clients:
    - iOS 12 (WebKit bug)
    - macOS 10.14 with Safari or embedded browser (WebKit bug)
    - UC Browser < 12.13.2
    - Chromium 51-66 (drops unrecognised SameSite values)

  @param {String} user_agent - User-Agent request header value

  @return {Boolean} - true if SameSite=None must NOT be set
  *********************************************************************/
  isSameSiteNoneIncompatible: function (user_agent) {

    return (
      _Cookies.hasWebKitSameSiteBug(user_agent) ||
      _Cookies.dropsUnrecognizedSameSiteCookies(user_agent)
    );

  }

};
////////////////////////////Public Functions END//////////////////////////////



//////////////////////////Private Functions START//////////////////////////////
const _Cookies = {

  /********************************************************************
  True for iOS 12 and macOS 10.14 Safari / embedded browser.
  *********************************************************************/
  hasWebKitSameSiteBug: function (user_agent) {

    return (
      _Cookies.isIosVersion(12, user_agent) ||
      (
        _Cookies.isMacosxVersion(10, 14, user_agent) &&
        (_Cookies.isSafari(user_agent) || _Cookies.isMacEmbeddedBrowser(user_agent))
      )
    );

  },


  /********************************************************************
  True for UC Browser < 12.13.2 and Chromium 51-66.
  *********************************************************************/
  dropsUnrecognizedSameSiteCookies: function (user_agent) {

    if (_Cookies.isUcBrowser(user_agent)) {
      return !_Cookies.isUcBrowserVersionAtLeast(12, 13, 2, user_agent);
    }

    return (
      _Cookies.isChromiumBased(user_agent) &&
      _Cookies.isChromiumVersionAtLeast(51, user_agent) &&
      !_Cookies.isChromiumVersionAtLeast(67, user_agent)
    );

  },


  isIosVersion: function (major, user_agent) {
    const regex = /\(iP.+; CPU .*OS (\d+)[_\d]*.*\) AppleWebKit\//;
    const match = user_agent.match(regex);
    return match !== null && parseInt(match[1], 10) === major;
  },


  isMacosxVersion: function (major, minor, user_agent) {
    const regex = /\(Macintosh;.*Mac OS X (\d+)_(\d+)[_\d]*.*\) AppleWebKit\//;
    const match = user_agent.match(regex);
    return (
      match !== null &&
      parseInt(match[1], 10) === major &&
      parseInt(match[2], 10) === minor
    );
  },


  isSafari: function (user_agent) {
    return /Version\/.* Safari\//.test(user_agent) && !_Cookies.isChromiumBased(user_agent);
  },


  isMacEmbeddedBrowser: function (user_agent) {
    return /^Mozilla\/[.\d]+ \(Macintosh;.*Mac OS X [_\d]+\) AppleWebKit\/[.\d]+ \(KHTML, like Gecko\)$/.test(user_agent);
  },


  isChromiumBased: function (user_agent) {
    return /Chrom(e|ium)/.test(user_agent);
  },


  isChromiumVersionAtLeast: function (major, user_agent) {
    const match = user_agent.match(/Chrom[^ /]+\/(\d+)/);
    return match !== null && parseInt(match[1], 10) >= major;
  },


  isUcBrowser: function (user_agent) {
    return /UCBrowser\//.test(user_agent);
  },


  isUcBrowserVersionAtLeast: function (major, minor, build, user_agent) {
    const match = user_agent.match(/UCBrowser\/(\d+)\.(\d+)\.(\d+)/);

    if (match === null) {
      return false;
    }

    const maj = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const bld = parseInt(match[3], 10);

    if (maj !== major) {
      return maj > major;
    }

    if (min !== minor) {
      return min > minor;
    }

    return bld >= build;
  }

};
//////////////////////////Private Functions END///////////////////////////////
