// Info: Client-side crypto utility library. UUID generation, random strings, base64 helpers.
// Browser-optimized: uses Web Crypto API with polyfill fallback.
//
// Factory pattern: each loader call returns an independent Crypto interface
// with its own Lib and CONFIG. Stateless - no per-instance resources.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib and CONFIG.

@param {Object} shared_libs - Lib container with Utils
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./crypto.config'),
    config || {}
  );

  // Create and return the public interface
  return createInterface(Lib, CONFIG);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib and CONFIG.

@param {Object} Lib - Dependency container (Utils)
@param {Object} CONFIG - Merged configuration for this instance

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG) {

  ///////////////////////////Public Functions START//////////////////////////////
  const Crypto = {

    /********************************************************************
  Generate random string from a character set.
  Uses Web Crypto when available, falls back to Math.random.

  @param {String} charset - Superset of characters to pick from
  @param {Integer} length - Desired length of output string

  @return {String} - Random string of specified length
  *********************************************************************/
    generateRandomString: function (charset, length) {

      if (Lib.Utils.isEmpty(charset) || Lib.Utils.isEmpty(length) || length <= 0) {
        return '';
      }

      const charset_length = charset.length;
      const output = new Array(length);
      const random_values = _Crypto.getRandomValues(length);

      for (let i = 0; i < length; i++) {
        output[i] = charset[random_values[i] % charset_length];
      }

      return output.join('');

    },


    /********************************************************************
  Generate UUIDv4 string

  @return {String} - Random UUIDv4 ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')
  *********************************************************************/
    generateUUID: function () {

      const web_crypto = _Crypto.webCrypto();

      if (web_crypto && Lib.Utils.isFunction(web_crypto.randomUUID)) {
        return web_crypto.randomUUID();
      }

      return _Crypto.uuidV4Polyfill();

    },


    /********************************************************************
  Generate compact UUID (25 characters, base36)
  Standard UUID with hyphens removed, converted to base36

  @return {String} - Compact UUID in base36 (25 chars)
  *********************************************************************/
    generateCompactUUID: function () {

      const uuid_hex = Crypto.generateUUID().replace(/-/g, '');

      return _Crypto.hexToBase36(uuid_hex).padEnd(25, '0');

    },


    /********************************************************************
  Convert UTF-8 string to base64

  @param {String} str - String to encode

  @return {String} - Base64 encoded string
  *********************************************************************/
    stringToBase64: function (str) {

      return _Crypto.utf8ToBase64(str);

    },


    /********************************************************************
  Convert base64 string to UTF-8 string

  @param {String} str - Base64 string to decode

  @return {String} - Decoded string
  *********************************************************************/
    base64ToString: function (str) {

      return _Crypto.base64ToUtf8(str);

    },


    /********************************************************************
  Convert standard base64 to URL-safe base64
  Replaces '+' with '-', '/' with '_', removes trailing '='

  @param {String} str - Standard base64 string

  @return {String} - URL-safe base64 string
  *********************************************************************/
    urlEncodeBase64: function (str) {

      return str
        .replace(/=/g, '')
        .replace(/\//g, '_')
        .replace(/\+/g, '-');

    },


    /********************************************************************
  Convert URL-safe base64 back to standard base64
  Replaces '-' with '+', '_' with '/', adds trailing '=' padding

  @param {String} str - URL-safe base64 string

  @return {String} - Standard base64 string
  *********************************************************************/
    urlDecodeBase64: function (str) {

      if (Lib.Utils.isEmpty(str)) {
        return str;
      }

      // Add padding to make length multiple of 4
      const pad_count = (4 - (str.length % 4)) % 4;
      str += '='.repeat(pad_count);

      return str
        .replace(/_/g, '/')
        .replace(/-/g, '+');

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _Crypto = {

    /********************************************************************
  Return Web Crypto object if available

  @return {Object|null}
  *********************************************************************/
    webCrypto: function () {

      if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        return globalThis.crypto;
      }

      return null;

    },


    /********************************************************************
  Generate random byte-like values

  @param {Integer} length

  @return {Array<Integer>}
  *********************************************************************/
    getRandomValues: function (length) {

      const values = new Array(length);
      const web_crypto = _Crypto.webCrypto();

      if (web_crypto && Lib.Utils.isFunction(web_crypto.getRandomValues)) {
        const random = new Uint8Array(length);
        web_crypto.getRandomValues(random);

        for (let i = 0; i < length; i++) {
          values[i] = random[i];
        }

        return values;
      }

      for (let j = 0; j < length; j++) {
        values[j] = Math.floor(Math.random() * 256);
      }

      return values;

    },


    /********************************************************************
  UUIDv4 polyfill when randomUUID is unavailable

  @return {String}
  *********************************************************************/
    uuidV4Polyfill: function () {

      const bytes = _Crypto.getRandomValues(16);

      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      let hex = '';
      for (let i = 0; i < 16; i++) {
        hex += (bytes[i] + 0x100).toString(16).slice(1);
      }

      return (
        hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
      );

    },


    /********************************************************************
  Convert hexadecimal string to base36

  @param {String} hex - Hexadecimal string

  @return {String} - Base36 string
  *********************************************************************/
    hexToBase36: function (hex) {

      let bigint_val = BigInt('0x' + hex);

      let result = '';
      const base = BigInt(36);
      const chars = CONFIG.BASE36_CHARSET;

      while (bigint_val > 0n) {
        result = chars[Number(bigint_val % base)] + result;
        bigint_val = bigint_val / base;
      }

      return result || '0';

    },


    /********************************************************************
  Encode UTF-8 string to base64 in browser/node compatible way

  @param {String} str

  @return {String}
  *********************************************************************/
    utf8ToBase64: function (str) {

      if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'utf8').toString('base64');
      }

      if (typeof btoa === 'function') {
        const bytes = new TextEncoder().encode(str);
        let binary = '';

        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        return btoa(binary);
      }

      throw new Error('Base64 encode is not supported in this environment');

    },


    /********************************************************************
  Decode base64 to UTF-8 string in browser/node compatible way

  @param {String} str

  @return {String}
  *********************************************************************/
    base64ToUtf8: function (str) {

      if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64').toString('utf8');
      }

      if (typeof atob === 'function') {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        return new TextDecoder().decode(bytes);
      }

      throw new Error('Base64 decode is not supported in this environment');

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return Crypto;

};/////////////////////////// createInterface END ///////////////////////////////
