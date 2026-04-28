// Info: Server-side cryptography utility library. Hashing, encryption, UUID, random strings, base conversion.
// Server-only: uses Node.js crypto module. Self-contained - no dependency on client crypto.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent Crypto interface
// with its own Lib and CONFIG. Stateless - no per-instance resources.
'use strict';

// Node.js built-in crypto module (stateless, shared across instances)
const NodeCrypto = require('crypto');



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
    Generate cryptographically secure random string from a character set

    @param {String} charset - Superset of characters to pick from
    @param {Integer} length - Desired length of output string

    @return {String} - Random string of specified length
    *********************************************************************/
    generateRandomString: function (charset, length) {

      if (Lib.Utils.isEmpty(charset) || Lib.Utils.isEmpty(length) || length <= 0) {
        return '';
      }

      const charset_length = charset.length;
      const random_buffer = NodeCrypto.randomBytes(length);
      const output = new Array(length);

      let cursor = 0;
      for (let i = 0; i < length; i++) {
        cursor += random_buffer[i];
        output[i] = charset[cursor % charset_length];
      }

      return output.join('');

    },


    /********************************************************************
    Generate time-prefixed random string (base36 time + random padding)

    @param {Integer} time - Current Unix time in seconds
    @param {Integer} [min_length] - (Optional) Minimum total length, padded with random chars
    @param {Integer} [epoch_offset] - (Optional) Custom epoch start date in seconds

    @return {String} - Time-based random string in base36
    *********************************************************************/
    generateTimeRandomString: function (time, min_length, epoch_offset) {

      // Apply epoch offset if provided
      if (!Lib.Utils.isNullOrUndefined(epoch_offset)) {
        time = time - epoch_offset;
      }

      // Convert time to base36
      let result = Crypto.intToBase36(time);

      // Pad with random characters if needed
      if (!Lib.Utils.isNullOrUndefined(min_length) && result.length < min_length) {
        result += Crypto.generateRandomString(
          CONFIG.BASE36_CHARSET,
          min_length - result.length
        );
      }

      return result;

    },


    /********************************************************************
    Generate UUIDv4 string (36 characters, hexadecimal)

    @return {String} - Random UUIDv4 ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')
    *********************************************************************/
    generateUUID: function () {

      return NodeCrypto.randomUUID();

    },


    /********************************************************************
    Generate compact UUID (25 characters, base36)
    Standard UUID with hyphens removed, converted to base36

    @return {String} - Compact UUID in base36 (25 chars)
    *********************************************************************/
    generateCompactUUID: function () {

      const uuid_hex = NodeCrypto.randomUUID().replace(/-/g, '');

      return _Crypto.hexToBase36(uuid_hex).padEnd(25, '0');

    },


    /********************************************************************
    Generate MD5 hash of a string (32 characters, hexadecimal)

    @param {String} str - String to hash

    @return {String} - MD5 hash
    *********************************************************************/
    md5String: function (str) {

      return NodeCrypto.createHash('md5').update(str).digest('hex');

    },


    /********************************************************************
    Generate HMAC-SHA256 hash of a string (64 characters, hexadecimal)

    @param {String} str - String to hash
    @param {String} [secret] - (Optional) Secret key for HMAC. Default ''

    @return {String} - SHA256 HMAC hash
    *********************************************************************/
    sha256String: function (str, secret) {

      if (Lib.Utils.isNullOrUndefined(secret)) {
        secret = '';
      }

      return NodeCrypto.createHmac('sha256', secret).update(str).digest('hex');

    },


    /********************************************************************
    Encrypt a string using AES-128-CBC

    @param {String} str - String to encrypt
    @param {String} secret - Secret key for encryption

    @return {String} - Encrypted hexadecimal string
    *********************************************************************/
    aesEncrypt: function (str, secret) {

      // Derive key and IV from secret
      const secret_hash_buffer = NodeCrypto.createHash('md5').update(secret).digest();
      const key = secret_hash_buffer.slice(0, 16);
      const iv = NodeCrypto.createHash('md5').update(key).update(secret).digest();

      // Encrypt
      const cipher = NodeCrypto.createCipheriv('aes-128-cbc', key, iv);

      return cipher.update(str, 'utf8', 'hex') + cipher.final('hex');

    },


    /********************************************************************
    Decrypt a string encrypted with AES-128-CBC

    @param {String} str - Encrypted hexadecimal string
    @param {String} secret - Secret key used for encryption

    @return {String} - Decrypted string
    *********************************************************************/
    aesDecrypt: function (str, secret) {

      // Derive key and IV from secret (same as encrypt)
      const secret_hash_buffer = NodeCrypto.createHash('md5').update(secret).digest();
      const key = secret_hash_buffer.slice(0, 16);
      const iv = NodeCrypto.createHash('md5').update(key).update(secret).digest();

      // Decrypt
      const decipher = NodeCrypto.createDecipheriv('aes-128-cbc', key, iv);

      return decipher.update(str, 'hex', 'utf8') + decipher.final('utf8');

    },


    /********************************************************************
    Convert integer to base36 string

    @param {Integer} num - Number to convert

    @return {String} - Base36 representation
    *********************************************************************/
    intToBase36: function (num) {

      return Number(num).toString(36);

    },


    /********************************************************************
    Convert base36 string to integer

    @param {String} str - Base36 string

    @return {Integer} - Numeric value
    *********************************************************************/
    base36ToInt: function (str) {

      return parseInt(str, 36);

    },


    /********************************************************************
    Convert string to base64

    @param {String} str - String to encode

    @return {String} - Base64 encoded string
    *********************************************************************/
    stringToBase64: function (str) {

      return Buffer.from(str).toString('base64');

    },


    /********************************************************************
    Convert base64 string to UTF-8 string

    @param {String} str - Base64 string to decode

    @return {String} - Decoded string
    *********************************************************************/
    base64ToString: function (str) {

      return Buffer.from(str, 'base64').toString('utf8');

    },


    /********************************************************************
    Convert Buffer to base64 string

    @param {Buffer} obj - Buffer object

    @return {String} - Base64 string
    *********************************************************************/
    bufferToBase64: function (obj) {

      return obj.toString('base64');

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

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return Crypto;

};/////////////////////////// createInterface END ///////////////////////////////
