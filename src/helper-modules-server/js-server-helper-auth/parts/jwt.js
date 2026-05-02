// Info: JWT helpers (Phase 5). HS256 via Node's native `crypto` - no
// third-party dependency. The signing key is shared across actor_types
// so a single secret can verify any instance's access token.
//
// Wire-format access token:
//   base64url(header) . base64url(payload) . base64url(sig)
// where header = {"alg":"HS256","typ":"JWT"} and payload carries the
// session + actor identity as standard + custom claims.
//
// Refresh tokens are opaque random strings (NOT JWTs). Only their
// SHA-256 hash is persisted in the session record's refresh_token_hash
// column; the plaintext is returned once at mint time.
'use strict';

const crypto = require('crypto');


// Charset for refresh tokens. Controlled so the token is URL-safe and
// contains neither '-' nor '#' (our module's reserved characters).
const REFRESH_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REFRESH_LENGTH = 48;


module.exports = function (Lib) {


  ////////////////////////////// Public Methods START /////////////////////////////
  const Jwt = {


    /********************************************************************
    Mint an access JWT. Returns a compact JWS string using HS256 over the
    provided claims + standard registered claims (iss, aud, iat, exp,
    jti, sub).

    @param {Object} options
    @param {Object} options.session - Canonical session record (for claims)
    @param {String} options.signing_key - HMAC secret
    @param {String} options.issuer - iss claim
    @param {String} options.audience - aud claim
    @param {Integer} options.access_token_ttl_seconds - lifetime in seconds
    @param {Integer} options.now - current epoch seconds (from instance.time)

    @return {String} - Compact JWS (three base64url segments joined by '.')
    *********************************************************************/
    signSessionJwt: function (options) {

      const header = { alg: 'HS256', typ: 'JWT' };

      const claims = {
        iss: options.issuer,
        aud: options.audience,
        iat: options.now,
        exp: options.now + options.access_token_ttl_seconds,
        // jti: unique token identifier for revocation / audit trails.
        //   Derived from the session's composite key so the same (tenant,
        //   actor, token_key) triple always produces the same jti.
        jti: options.session.tenant_id + '#' +
             options.session.actor_id + '#' +
             options.session.token_key,
        sub: options.session.actor_id,
        atp: options.session.actor_type,
        tid: options.session.tenant_id,
        ikd: options.session.install_id,
        tkk: options.session.token_key
      };

      const header_segment  = Jwt.base64UrlEncode(JSON.stringify(header));
      const payload_segment = Jwt.base64UrlEncode(JSON.stringify(claims));
      const signing_input   = header_segment + '.' + payload_segment;

      const sig = crypto
        .createHmac('sha256', options.signing_key)
        .update(signing_input)
        .digest();

      const signature_segment = Jwt.base64UrlEncodeBuffer(sig);

      return signing_input + '.' + signature_segment;

    },


    /********************************************************************
    Verify a JWT signature + standard claims. Returns a result object
    with the decoded claims on success or an error code otherwise.
    Entirely in-memory - no DB read.

    @param {Object} options
    @param {String} options.jwt - compact JWS string
    @param {String} options.signing_key - HMAC secret
    @param {String} options.issuer - expected iss
    @param {String} options.audience - expected aud
    @param {Integer} options.now - current epoch seconds

    @return {Object} - { success, claims, error_code }
      error_code: 'MALFORMED' | 'BAD_ALG' | 'BAD_SIGNATURE'
                  | 'EXPIRED' | 'BAD_ISSUER' | 'BAD_AUDIENCE'
    *********************************************************************/
    verifySessionJwt: function (options) {

      if (
        Lib.Utils.isNullOrUndefined(options.jwt) ||
        !Lib.Utils.isString(options.jwt)
      ) {
        return { success: false, claims: null, error_code: 'MALFORMED' };
      }

      const parts = options.jwt.split('.');
      if (parts.length !== 3) {
        return { success: false, claims: null, error_code: 'MALFORMED' };
      }

      let header;
      let claims;
      try {
        header = JSON.parse(Jwt.base64UrlDecode(parts[0]));
        claims = JSON.parse(Jwt.base64UrlDecode(parts[1]));
      } catch (err) {
        void err;
        return { success: false, claims: null, error_code: 'MALFORMED' };
      }

      if (header.alg !== 'HS256') {
        return { success: false, claims: null, error_code: 'BAD_ALG' };
      }

      // Recompute signature using constant-time compare
      const expected_sig = crypto
        .createHmac('sha256', options.signing_key)
        .update(parts[0] + '.' + parts[1])
        .digest();

      let provided_sig;
      try {
        provided_sig = Buffer.from(
          parts[2].replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        );
      } catch (err) {
        void err;
        return { success: false, claims: null, error_code: 'MALFORMED' };
      }

      if (
        provided_sig.length !== expected_sig.length ||
        !crypto.timingSafeEqual(provided_sig, expected_sig)
      ) {
        return { success: false, claims: null, error_code: 'BAD_SIGNATURE' };
      }

      // Expiry check (strict less-than gives a leeway of exactly the
      // second boundary)
      if (typeof claims.exp !== 'number' || claims.exp < options.now) {
        return { success: false, claims: null, error_code: 'EXPIRED' };
      }

      if (!Lib.Utils.isNullOrUndefined(options.issuer) && claims.iss !== options.issuer) {
        return { success: false, claims: null, error_code: 'BAD_ISSUER' };
      }

      if (!Lib.Utils.isNullOrUndefined(options.audience) && claims.aud !== options.audience) {
        return { success: false, claims: null, error_code: 'BAD_AUDIENCE' };
      }

      return { success: true, claims: claims, error_code: null };

    },


    /********************************************************************
    Generate a random opaque refresh token. Returns the plaintext; the
    caller hashes it before persisting.

    @return {String} - Random refresh token
    *********************************************************************/
    generateRefreshToken: function () {

      return Lib.Crypto.generateRandomString(REFRESH_CHARSET, REFRESH_LENGTH);

    },


    /********************************************************************
    Deterministic hash of a refresh token for DB storage. Uses the auth
    module's SHA-256 helper so it matches the token_secret_hash algorithm.

    @param {String} refresh_token - Plaintext refresh token

    @return {String} - Hex-encoded SHA-256 hash (64 chars)
    *********************************************************************/
    hashRefreshToken: function (refresh_token) {

      return Lib.Crypto.sha256String(refresh_token, '');

    },


    /********************************************************************
    base64url encoder for UTF-8 strings.
    *********************************************************************/
    base64UrlEncode: function (str) {

      return Buffer.from(str, 'utf8')
        .toString('base64')
        .replace(/=+$/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    },


    /********************************************************************
    base64url encoder for raw Buffers.
    *********************************************************************/
    base64UrlEncodeBuffer: function (buffer) {

      return buffer
        .toString('base64')
        .replace(/=+$/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    },


    /********************************************************************
    base64url decoder - returns UTF-8 string.
    *********************************************************************/
    base64UrlDecode: function (str) {

      // Restore padding so Node's decoder accepts the input
      const pad = str.length % 4;
      const padded = pad === 0 ? str : str + '='.repeat(4 - pad);
      return Buffer
        .from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
        .toString('utf8');

    }


  };//////////////////////////// Public Methods END //////////////////////////////


  return Jwt;

};
