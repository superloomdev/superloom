// Info: Session lifecycle and authentication. Multi-instance per actor_type:
// each loader call returns an independent Auth interface bound to one
// actor_type, one storage backend, and one CONFIG. Instances do not share
// state - the underlying store driver (Lib.Postgres, Lib.DynamoDB, ...)
// is itself multi-instance.
//
// Public surface:
//   - DB-mode (ENABLE_JWT=false, default): createSession, verifySession,
//     removeSession, removeOtherSessions, removeAllSessions, listSessions,
//     countSessions, listPushTargetsByActor, attachDeviceToSession,
//     detachDeviceFromSession, initializeSessionStore,
//     cleanupExpiredSessions, createAuthId, parseAuthId
//   - JWT-mode (ENABLE_JWT=true) extends the surface with: verifyJwt,
//     signSessionJwt, refreshSessionJwt. createSession additionally
//     returns access_token + refresh_token in this mode.
//
// Storage backends: memory (tests), sqlite, postgres, mysql, mongodb, dynamodb.
//
// Compatibility: Node.js 20.19+
'use strict';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call returns one independent Auth instance for one
actor_type. Validates the config + builds the store at construction so
misconfiguration fails fast at startup, not on first request.

@param {Object} shared_libs - Lib container with Utils, Debug, Crypto, Instance
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this Auth instance
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance. Each store may pull additional libs
  // (Lib.Postgres etc.) from CONFIG.STORE_CONFIG - not from here.
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Crypto: shared_libs.Crypto,
    Instance: shared_libs.Instance
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./auth.config'),
    config || {}
  );

  // Validate the config shape; throws on missing required keys
  validateConfig(Lib, CONFIG);

  // Construct internal helpers (each closes over Lib only)
  const RecordShape = require('./parts/record-shape')(Lib);
  const AuthId = require('./parts/auth-id')(Lib);
  const Validators = require('./parts/validators')(Lib);
  const Policy = require('./parts/policy')(Lib);
  const Cookie = require('./parts/cookie')(Lib);
  const TokenSource = require('./parts/token-source')(Lib, Cookie);
  const Jwt = require('./parts/jwt')(Lib);

  // Resolve the requested store via the lazy registry. Only the chosen
  // store file is loaded; others stay on disk.
  const loadStoreFactory = require('./stores');
  const StoreFactory = loadStoreFactory(CONFIG.STORE);
  const store = StoreFactory(Lib, CONFIG.STORE_CONFIG || {});

  // Build the public interface, closing over Lib + CONFIG + the constructed parts
  return createInterface({
    Lib: Lib,
    CONFIG: CONFIG,
    RecordShape: RecordShape,
    AuthId: AuthId,
    Validators: Validators,
    Policy: Policy,
    Cookie: Cookie,
    TokenSource: TokenSource,
    Jwt: Jwt,
    store: store
  });

};///////////////////////////// Module-Loader END ///////////////////////////////



//////////////////////////// Config Validation START ///////////////////////////

/********************************************************************
Validate the merged CONFIG. Throws on every missing-required violation
so the loader fails before serving a single request.

@param {Object} Lib - Dependency container
@param {Object} CONFIG - Merged configuration

@return {void}
*********************************************************************/
const validateConfig = function (Lib, CONFIG) {

  // STORE name is required and must be a non-empty string
  if (
    Lib.Utils.isNullOrUndefined(CONFIG.STORE) ||
    !Lib.Utils.isString(CONFIG.STORE) ||
    Lib.Utils.isEmptyString(CONFIG.STORE)
  ) {
    throw new Error('[js-server-helper-auth] CONFIG.STORE is required (one of the supported store names)');
  }

  // STORE_CONFIG is required (may be empty object for the memory store).
  if (Lib.Utils.isNullOrUndefined(CONFIG.STORE_CONFIG)) {
    throw new Error('[js-server-helper-auth] CONFIG.STORE_CONFIG is required (object)');
  }

  if (!Lib.Utils.isObject(CONFIG.STORE_CONFIG)) {
    throw new Error('[js-server-helper-auth] CONFIG.STORE_CONFIG must be a plain object');
  }

  // ACTOR_TYPE is required and must be a non-empty string
  if (
    Lib.Utils.isNullOrUndefined(CONFIG.ACTOR_TYPE) ||
    !Lib.Utils.isString(CONFIG.ACTOR_TYPE) ||
    Lib.Utils.isEmptyString(CONFIG.ACTOR_TYPE)
  ) {
    throw new Error('[js-server-helper-auth] CONFIG.ACTOR_TYPE is required (non-empty string)');
  }

  // TTL_SECONDS must be a positive integer
  if (
    !Lib.Utils.isNumber(CONFIG.TTL_SECONDS) ||
    !Lib.Utils.isInteger(CONFIG.TTL_SECONDS) ||
    CONFIG.TTL_SECONDS <= 0
  ) {
    throw new Error('[js-server-helper-auth] CONFIG.TTL_SECONDS must be a positive integer');
  }

  // LAST_ACTIVE_UPDATE_INTERVAL_SECONDS must be a non-negative integer
  if (
    !Lib.Utils.isNumber(CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS) ||
    !Lib.Utils.isInteger(CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS) ||
    CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS < 0
  ) {
    throw new Error('[js-server-helper-auth] CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS must be a non-negative integer');
  }

  // LIMITS object required with proper shape
  if (Lib.Utils.isNullOrUndefined(CONFIG.LIMITS) || !Lib.Utils.isObject(CONFIG.LIMITS)) {
    throw new Error('[js-server-helper-auth] CONFIG.LIMITS is required (plain object)');
  }

  if (
    !Lib.Utils.isNumber(CONFIG.LIMITS.total_max) ||
    !Lib.Utils.isInteger(CONFIG.LIMITS.total_max) ||
    CONFIG.LIMITS.total_max <= 0
  ) {
    throw new Error('[js-server-helper-auth] CONFIG.LIMITS.total_max must be a positive integer');
  }

  if (!Lib.Utils.isBoolean(CONFIG.LIMITS.evict_oldest_on_limit)) {
    throw new Error('[js-server-helper-auth] CONFIG.LIMITS.evict_oldest_on_limit must be a boolean');
  }

  // JWT mode (Phase 5+): when enabled, signing key + issuer + audience
  // are mandatory. The signing key must be at least 32 bytes long so
  // an HS256 HMAC has a full security margin.
  if (CONFIG.ENABLE_JWT === true) {

    if (Lib.Utils.isNullOrUndefined(CONFIG.JWT) || !Lib.Utils.isObject(CONFIG.JWT)) {
      throw new Error('[js-server-helper-auth] CONFIG.JWT must be a plain object when ENABLE_JWT is true');
    }

    if (
      Lib.Utils.isNullOrUndefined(CONFIG.JWT.signing_key) ||
      !Lib.Utils.isString(CONFIG.JWT.signing_key) ||
      CONFIG.JWT.signing_key.length < 32
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.JWT.signing_key must be a string of at least 32 chars when ENABLE_JWT is true');
    }

    if (
      Lib.Utils.isNullOrUndefined(CONFIG.JWT.issuer) ||
      !Lib.Utils.isString(CONFIG.JWT.issuer) ||
      Lib.Utils.isEmptyString(CONFIG.JWT.issuer)
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.JWT.issuer is required (non-empty string) when ENABLE_JWT is true');
    }

    if (
      Lib.Utils.isNullOrUndefined(CONFIG.JWT.audience) ||
      !Lib.Utils.isString(CONFIG.JWT.audience) ||
      Lib.Utils.isEmptyString(CONFIG.JWT.audience)
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.JWT.audience is required (non-empty string) when ENABLE_JWT is true');
    }

    if (
      !Lib.Utils.isNumber(CONFIG.JWT.access_token_ttl_seconds) ||
      !Lib.Utils.isInteger(CONFIG.JWT.access_token_ttl_seconds) ||
      CONFIG.JWT.access_token_ttl_seconds <= 0
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.JWT.access_token_ttl_seconds must be a positive integer when ENABLE_JWT is true');
    }

    if (
      !Lib.Utils.isNumber(CONFIG.JWT.refresh_token_ttl_seconds) ||
      !Lib.Utils.isInteger(CONFIG.JWT.refresh_token_ttl_seconds) ||
      CONFIG.JWT.refresh_token_ttl_seconds <= 0
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.JWT.refresh_token_ttl_seconds must be a positive integer when ENABLE_JWT is true');
    }

  }

  // ERRORS catalog required
  if (Lib.Utils.isNullOrUndefined(CONFIG.ERRORS)) {
    throw new Error('[js-server-helper-auth] CONFIG.ERRORS is required (map of failure key to your domain error object)');
  }

  const required_error_keys = [
    'LIMIT_REACHED',
    'SESSION_NOT_FOUND',
    'SESSION_EXPIRED',
    'INVALID_TOKEN',
    'ACTOR_TYPE_MISMATCH',
    'SERVICE_UNAVAILABLE'
  ];
  for (const error_key of required_error_keys) {
    if (Lib.Utils.isNullOrUndefined(CONFIG.ERRORS[error_key])) {
      throw new Error('[js-server-helper-auth] CONFIG.ERRORS.' + error_key + ' is required');
    }
  }

};

//////////////////////////// Config Validation END /////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Build the public interface. All public functions close over the parts
and CONFIG passed in - no module-level mutable state.

@param {Object} deps - Constructed parts and config

@return {Object} - The public Auth interface
*********************************************************************/
const createInterface = function (deps) {

  const Lib = deps.Lib;
  const CONFIG = deps.CONFIG;
  const RecordShape = deps.RecordShape;
  const AuthId = deps.AuthId;
  const Validators = deps.Validators;
  const Policy = deps.Policy;
  const Cookie = deps.Cookie;
  const TokenSource = deps.TokenSource;
  const Jwt = deps.Jwt;
  const store = deps.store;


  ////////////////////////////// Public Functions START //////////////////////////
  const Auth = {

    /********************************************************************
    Create a new session for an actor. Enforces tier limits + same-install
    replacement via the list-then-filter algorithm. Stamps a Set-Cookie
    on the response if instance.http_response is present.

    @param {Object} instance - Request instance (provides time + lifecycle)
    @param {Object} options - See parts/validators.js validateCreateSessionOptions

    @return {Promise<Object>} - { success, auth_id, session, error }
    *********************************************************************/
    createSession: async function (instance, options) {

      Validators.validateCreateSessionOptions(options);

      const now = instance.time;

      // Generate a fresh credential pair for this session
      const token_key = AuthId.generateTokenKey();
      const token_secret = AuthId.generateTokenSecret();
      const token_secret_hash = AuthId.hashTokenSecret(token_secret);

      // Load any existing sessions for this actor so we can apply the
      // limit policy
      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      if (list_result.success === false) {
        Lib.Debug.debug('Auth createSession: store list failed', { error: list_result.error });
        return {
          success: false,
          auth_id: null,
          session: null,
          error: CONFIG.ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Run the pure list-then-filter policy
      const decision = Policy.applyLimits({
        existing: list_result.records,
        now: now,
        install_id: Lib.Utils.fallback(options.install_id, null),
        install_form_factor: options.install_form_factor,
        install_platform: options.install_platform,
        limits: CONFIG.LIMITS
      });

      if (decision.decision === 'reject') {
        return {
          success: false,
          auth_id: null,
          session: null,
          error: CONFIG.ERRORS.LIMIT_REACHED
        };
      }

      // Delete any sessions the policy queued for removal (same-install
      // replacements + LRU evictions)
      if (decision.to_delete.length > 0) {

        const delete_keys = decision.to_delete.map(function (session) {
          return { actor_id: session.actor_id, token_key: session.token_key };
        });
        const delete_result = await store.deleteSessions(
          instance,
          options.tenant_id,
          delete_keys
        );

        if (delete_result.success === false) {
          Lib.Debug.debug('Auth createSession: pre-insert delete failed', { error: delete_result.error });
          return {
            success: false,
            auth_id: null,
            session: null,
            error: CONFIG.ERRORS.SERVICE_UNAVAILABLE
          };
        }

      }

      // JWT mode: also mint a refresh token (opaque) and stash its hash
      // on the record so the refresh endpoint can rotate it later.
      let refresh_token_plaintext = null;
      let refresh_token_hash = null;
      if (CONFIG.ENABLE_JWT === true) {
        refresh_token_plaintext = Jwt.generateRefreshToken();
        refresh_token_hash = Jwt.hashRefreshToken(refresh_token_plaintext);
      }

      // Build the canonical record
      const record = RecordShape.buildRecord({
        tenant_id: options.tenant_id,
        actor_id: options.actor_id,
        actor_type: CONFIG.ACTOR_TYPE,
        token_key: token_key,
        token_secret_hash: token_secret_hash,
        refresh_token_hash: refresh_token_hash,
        created_at: now,
        expires_at: now + CONFIG.TTL_SECONDS,
        last_active_at: now,
        install_id: options.install_id,
        install_platform: options.install_platform,
        install_form_factor: options.install_form_factor,
        client_name: options.client_name,
        client_version: options.client_version,
        client_is_browser: options.client_is_browser,
        client_os_name: options.client_os_name,
        client_os_version: options.client_os_version,
        client_screen_w: options.client_screen_w,
        client_screen_h: options.client_screen_h,
        client_ip_address: options.client_ip_address,
        client_user_agent: options.client_user_agent,
        custom_data: options.custom_data
      });

      // Persist the new session
      const set_result = await store.setSession(instance, record);
      if (set_result.success === false) {
        Lib.Debug.debug('Auth createSession: store write failed', { error: set_result.error });
        return {
          success: false,
          auth_id: null,
          session: null,
          error: CONFIG.ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Build the wire-format auth_id
      const auth_id = AuthId.createAuthId({
        actor_id: options.actor_id,
        token_key: token_key,
        token_secret: token_secret
      });

      // Stamp the Set-Cookie header if a cookie prefix is configured
      if (
        !Lib.Utils.isNullOrUndefined(CONFIG.COOKIE_PREFIX) &&
        Lib.Utils.isString(CONFIG.COOKIE_PREFIX) &&
        !Lib.Utils.isEmptyString(CONFIG.COOKIE_PREFIX)
      ) {
        Cookie.setCookieOnResponse(
          instance,
          Cookie.composeCookieName(CONFIG.COOKIE_PREFIX, options.tenant_id),
          auth_id,
          Object.assign({}, CONFIG.COOKIE_OPTIONS, { max_age: CONFIG.TTL_SECONDS })
        );
      }

      // Mint access + refresh tokens for JWT mode. Refresh token is the
      // wire format `{actor_id}-{token_key}-{refresh_secret}` so the
      // refresh endpoint can locate the session without a separate
      // tenant-wide scan.
      let access_token = null;
      let refresh_token = null;
      if (CONFIG.ENABLE_JWT === true) {
        access_token = Jwt.signSessionJwt({
          session: record,
          signing_key: CONFIG.JWT.signing_key,
          issuer: CONFIG.JWT.issuer,
          audience: CONFIG.JWT.audience,
          access_token_ttl_seconds: CONFIG.JWT.access_token_ttl_seconds,
          now: now
        });
        refresh_token = options.actor_id + '-' + token_key + '-' + refresh_token_plaintext;
      }

      return {
        success: true,
        auth_id: auth_id,
        access_token: access_token,
        refresh_token: refresh_token,
        session: record,
        error: null
      };

    },


    /********************************************************************
    Verify an inbound auth_id (or read it from the request via the
    token-source priority chain). Hydrates instance.session on success.
    Schedules a throttled background refresh of last_active_at +
    expires_at + client_* fields when LAST_ACTIVE_UPDATE_INTERVAL_SECONDS
    has elapsed since the last refresh.

    @param {Object} instance - Request instance
    @param {Object} [options] - Optional explicit auth_id + tenant_id

    @return {Promise<Object>} - { success, session, error }
    *********************************************************************/
    verifySession: async function (instance, options) {

      Validators.validateVerifySessionOptions(options);
      const safe_options = options || {};

      // Resolve the auth_id from explicit option or from instance headers/cookies
      let auth_id = safe_options.auth_id;
      if (Lib.Utils.isNullOrUndefined(auth_id)) {
        auth_id = TokenSource.readAuthId(instance, {
          cookie_prefix: CONFIG.COOKIE_PREFIX,
          tenant_id: safe_options.tenant_id
        });
      }

      if (Lib.Utils.isNullOrUndefined(auth_id)) {
        return {
          success: false,
          session: null,
          error: CONFIG.ERRORS.INVALID_TOKEN
        };
      }

      // Parse the wire format
      const parts = AuthId.parseAuthId(auth_id);
      if (parts === null) {
        return {
          success: false,
          session: null,
          error: CONFIG.ERRORS.INVALID_TOKEN
        };
      }

      // Need a tenant_id to scope the lookup; the caller supplies it
      // (typically derived from the request path or subdomain).
      if (
        Lib.Utils.isNullOrUndefined(safe_options.tenant_id) ||
        !Lib.Utils.isString(safe_options.tenant_id) ||
        Lib.Utils.isEmptyString(safe_options.tenant_id)
      ) {
        throw new TypeError('[js-server-helper-auth] verifySession requires options.tenant_id');
      }

      // Hash the secret to compare against the stored hash
      const token_secret_hash = AuthId.hashTokenSecret(parts.token_secret);

      const get_result = await store.getSession(
        instance,
        safe_options.tenant_id,
        parts.actor_id,
        parts.token_key,
        token_secret_hash
      );

      if (get_result.success === false) {
        Lib.Debug.debug('Auth verifySession: store read failed', { error: get_result.error });
        return {
          success: false,
          session: null,
          error: CONFIG.ERRORS.SERVICE_UNAVAILABLE
        };
      }

      if (get_result.record === null) {
        return {
          success: false,
          session: null,
          error: CONFIG.ERRORS.INVALID_TOKEN
        };
      }

      const record = get_result.record;

      // Lifecycle check
      if (record.expires_at < instance.time) {
        return {
          success: false,
          session: null,
          error: CONFIG.ERRORS.SESSION_EXPIRED
        };
      }

      // Layer-2 actor_type defense: the record came from a per-actor_type
      // table, but if a project ever points two instances at the same
      // table by mistake, we catch the mismatch here.
      if (record.actor_type !== CONFIG.ACTOR_TYPE) {
        return {
          success: false,
          session: null,
          error: CONFIG.ERRORS.ACTOR_TYPE_MISMATCH
        };
      }

      // Throttled refresh: if the last activity update is older than
      // the configured interval, fire a background write.
      if ((instance.time - record.last_active_at) >= CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS) {

        scheduleBackgroundRefresh({
          Lib: Lib,
          store: store,
          instance: instance,
          record: record,
          ttl_seconds: CONFIG.TTL_SECONDS,
          options: safe_options
        });

      }

      // Hydrate the request instance
      instance.session = record;

      return {
        success: true,
        session: record,
        error: null
      };

    },


    /********************************************************************
    Delete one session by (tenant_id, actor_id, token_key).

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, token_key }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    removeSession: async function (instance, options) {

      Validators.validateRemoveSessionOptions(options);

      const result = await store.deleteSession(
        instance,
        options.tenant_id,
        options.actor_id,
        options.token_key
      );

      if (result.success === false) {
        Lib.Debug.debug('Auth removeSession: store delete failed', { error: result.error });
        return { success: false, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      // Clear the cookie if a prefix is configured
      if (
        !Lib.Utils.isNullOrUndefined(CONFIG.COOKIE_PREFIX) &&
        Lib.Utils.isString(CONFIG.COOKIE_PREFIX) &&
        !Lib.Utils.isEmptyString(CONFIG.COOKIE_PREFIX)
      ) {
        Cookie.clearCookieOnResponse(
          instance,
          Cookie.composeCookieName(CONFIG.COOKIE_PREFIX, options.tenant_id),
          CONFIG.COOKIE_OPTIONS
        );
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Delete all sessions for an actor EXCEPT the one identified by
    keep_token_key. Used for "log out everywhere else".

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, keep_token_key }

    @return {Promise<Object>} - { success, removed_count, error }
    *********************************************************************/
    removeOtherSessions: async function (instance, options) {

      Validators.validateRemoveOtherSessionsOptions(options);

      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      if (list_result.success === false) {
        return { success: false, removed_count: 0, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      const targets = list_result.records.filter(function (session) {
        return session.token_key !== options.keep_token_key;
      });

      if (targets.length === 0) {
        return { success: true, removed_count: 0, error: null };
      }

      const delete_keys = targets.map(function (session) {
        return { actor_id: session.actor_id, token_key: session.token_key };
      });

      const delete_result = await store.deleteSessions(instance, options.tenant_id, delete_keys);
      if (delete_result.success === false) {
        return { success: false, removed_count: 0, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, removed_count: targets.length, error: null };

    },


    /********************************************************************
    Delete all sessions for an actor. Used for password reset and
    forced re-auth.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, removed_count, error }
    *********************************************************************/
    removeAllSessions: async function (instance, options) {

      Validators.validateActorScopedOptions(options, 'removeAllSessions');

      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      if (list_result.success === false) {
        return { success: false, removed_count: 0, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      if (list_result.records.length === 0) {
        return { success: true, removed_count: 0, error: null };
      }

      const delete_keys = list_result.records.map(function (session) {
        return { actor_id: session.actor_id, token_key: session.token_key };
      });

      const delete_result = await store.deleteSessions(instance, options.tenant_id, delete_keys);
      if (delete_result.success === false) {
        return { success: false, removed_count: 0, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      // Clear the cookie if a prefix is configured (best-effort)
      if (
        !Lib.Utils.isNullOrUndefined(CONFIG.COOKIE_PREFIX) &&
        Lib.Utils.isString(CONFIG.COOKIE_PREFIX) &&
        !Lib.Utils.isEmptyString(CONFIG.COOKIE_PREFIX)
      ) {
        Cookie.clearCookieOnResponse(
          instance,
          Cookie.composeCookieName(CONFIG.COOKIE_PREFIX, options.tenant_id),
          CONFIG.COOKIE_OPTIONS
        );
      }

      return { success: true, removed_count: list_result.records.length, error: null };

    },


    /********************************************************************
    List all sessions for an actor. The classic "Active devices" UI
    backend. Does not modify state.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, sessions, error }
    *********************************************************************/
    listSessions: async function (instance, options) {

      Validators.validateActorScopedOptions(options, 'listSessions');

      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      if (list_result.success === false) {
        return { success: false, sessions: null, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      // Filter expired sessions client-side - they will be cleaned up later
      const now = instance.time;
      const active = list_result.records.filter(function (session) {
        return session.expires_at > now;
      });

      return { success: true, sessions: active, error: null };

    },


    /********************************************************************
    Count active sessions for an actor. Convenience wrapper over
    listSessions for callers that need only a number.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, count, error }
    *********************************************************************/
    countSessions: async function (instance, options) {

      const list = await Auth.listSessions(instance, options);
      if (list.success === false) {
        return { success: false, count: 0, error: list.error };
      }

      return { success: true, count: list.sessions.length, error: null };

    },


    /********************************************************************
    List active sessions whose push_provider + push_token are both set.
    Used by a push-notification module to fan out a message to all
    devices owned by an actor without re-querying device state on every
    push call.

    Returns the canonical session shape; the push module reads
    push_provider + push_token + install_platform + install_form_factor
    from each record. Sessions with null push fields are omitted, as
    are expired sessions (mirrors listSessions).

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, targets, error }
    *********************************************************************/
    listPushTargetsByActor: async function (instance, options) {

      Validators.validateActorScopedOptions(options, 'listPushTargetsByActor');

      const list = await Auth.listSessions(instance, options);
      if (list.success === false) {
        return { success: false, targets: null, error: list.error };
      }

      const targets = list.sessions.filter(function (s) {
        return (
          !Lib.Utils.isNullOrUndefined(s.push_provider) &&
          !Lib.Utils.isNullOrUndefined(s.push_token) &&
          !Lib.Utils.isEmptyString(s.push_provider) &&
          !Lib.Utils.isEmptyString(s.push_token)
        );
      });

      return { success: true, targets: targets, error: null };

    },


    /********************************************************************
    Bind a push provider + token to an existing session. Called after
    the client app obtains push permission from the OS / browser.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, token_key, push_provider, push_token }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    attachDeviceToSession: async function (instance, options) {

      Validators.validateAttachDeviceOptions(options);

      const result = await store.updateSessionActivity(
        instance,
        options.tenant_id,
        options.actor_id,
        options.token_key,
        {
          push_provider: options.push_provider,
          push_token: options.push_token
        }
      );

      if (result.success === false) {
        return { success: false, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Unbind the push provider + token from a session. Called when the OS
    revokes the token, or the client opts out of push.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, token_key }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    detachDeviceFromSession: async function (instance, options) {

      Validators.validateDetachDeviceOptions(options);

      const result = await store.updateSessionActivity(
        instance,
        options.tenant_id,
        options.actor_id,
        options.token_key,
        {
          push_provider: null,
          push_token: null
        }
      );

      if (result.success === false) {
        return { success: false, error: CONFIG.ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Idempotent backend setup. Creates tables / TTL / indexes via the
    store's initialize hook. Safe to call multiple times.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    initializeSessionStore: async function (instance) {

      const result = await store.initialize(instance);
      return result;

    },


    /********************************************************************
    Sweep expired sessions. Optional - only useful for SQL backends
    without native TTL. Recommended frequency: once per day via cron.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      if (!Lib.Utils.isFunction(store.cleanupExpiredSessions)) {
        return {
          success: false,
          deleted_count: 0,
          error: { type: 'CLEANUP_NOT_SUPPORTED', message: 'Storage adapter does not implement cleanupExpiredSessions' }
        };
      }

      try {
        return await store.cleanupExpiredSessions(instance);
      } catch (err) {
        Lib.Debug.debug('Auth cleanupExpiredSessions threw', { error: err.message });
        return {
          success: false,
          deleted_count: 0,
          error: { type: 'CLEANUP_FAILED', message: err.message }
        };
      }

    },


    /********************************************************************
    Pure helper: build a wire-format auth_id from its three parts.
    Useful for tests and for flows that mint an auth_id outside of
    createSession.

    @param {Object} parts - { actor_id, token_key, token_secret }

    @return {String} - The wire-format auth_id
    *********************************************************************/
    createAuthId: function (parts) {

      return AuthId.createAuthId(parts);

    },


    /********************************************************************
    Pure helper: parse a wire-format auth_id back into its three parts.
    Returns null if the shape is wrong.

    @param {String} auth_id - The wire-format string

    @return {Object|null} - { actor_id, token_key, token_secret } or null
    *********************************************************************/
    parseAuthId: function (auth_id) {

      return AuthId.parseAuthId(auth_id);

    },


    /********************************************************************
    Stateless JWT verification. Decodes + verifies the signature and
    standard claims (iat / exp / iss / aud) without any DB read. Use
    this on every authenticated request when JWT mode is enabled - the
    DB is consulted only on /refresh.

    Returns either the verified claims or one of the standard auth
    errors mapped from CONFIG.ERRORS.

    @param {Object} instance - Request instance
    @param {Object} options
    @param {String} options.jwt - Compact JWS string (access token)

    @return {Object} - { success, claims, error }
    *********************************************************************/
    verifyJwt: function (instance, options) {

      if (CONFIG.ENABLE_JWT !== true) {
        throw new Error('[js-server-helper-auth] verifyJwt requires CONFIG.ENABLE_JWT=true');
      }

      void instance;

      const safe_options = options || {};
      const result = Jwt.verifySessionJwt({
        jwt: safe_options.jwt,
        signing_key: CONFIG.JWT.signing_key,
        issuer: CONFIG.JWT.issuer,
        audience: CONFIG.JWT.audience,
        now: instance.time
      });

      if (result.success === true) {

        // Defense in depth: a JWT signed by a sibling Auth instance
        // (different ACTOR_TYPE) carrying the same signing key must
        // not authenticate against this instance. Mirrors the layer-2
        // check inside verifySession (DB-backed mode).
        if (result.claims.atp !== CONFIG.ACTOR_TYPE) {
          return {
            success: false,
            claims: null,
            error: CONFIG.ERRORS.ACTOR_TYPE_MISMATCH
          };
        }

        return {
          success: true,
          claims: result.claims,
          error: null
        };
      }

      // Map JWT-specific error codes to the project's domain errors
      let domain_error;
      switch (result.error_code) {
      case 'EXPIRED':
        domain_error = CONFIG.ERRORS.SESSION_EXPIRED;
        break;
      case 'MALFORMED':
      case 'BAD_ALG':
      case 'BAD_SIGNATURE':
      case 'BAD_ISSUER':
      case 'BAD_AUDIENCE':
      default:
        domain_error = CONFIG.ERRORS.INVALID_TOKEN;
        break;
      }

      return {
        success: false,
        claims: null,
        error: domain_error
      };

    },


    /********************************************************************
    Mint a fresh access JWT for an existing session. Useful after
    verifySession - e.g., a "session warmup" endpoint that hands out
    short-lived JWTs based on a long-lived auth_id cookie.

    @param {Object} instance - Request instance
    @param {Object} options
    @param {Object} options.session - Canonical session record

    @return {Object} - { success, access_token, error }
    *********************************************************************/
    signSessionJwt: function (instance, options) {

      if (CONFIG.ENABLE_JWT !== true) {
        throw new Error('[js-server-helper-auth] signSessionJwt requires CONFIG.ENABLE_JWT=true');
      }

      const access_token = Jwt.signSessionJwt({
        session: options.session,
        signing_key: CONFIG.JWT.signing_key,
        issuer: CONFIG.JWT.issuer,
        audience: CONFIG.JWT.audience,
        access_token_ttl_seconds: CONFIG.JWT.access_token_ttl_seconds,
        now: instance.time
      });

      return {
        success: true,
        access_token: access_token,
        error: null
      };

    },


    /********************************************************************
    Exchange a refresh token for a new access + new refresh token. The
    old refresh token is invalidated by rotating the stored hash. The
    underlying session record is touched (last_active_at / expires_at)
    so a steady refresh stream keeps the session alive.

    Refresh token wire format:
      "{actor_id}-{token_key}-{refresh_secret}"

    @param {Object} instance - Request instance
    @param {Object} options
    @param {String} options.tenant_id - Required (refresh tokens scope by tenant)
    @param {String} options.refresh_token - The wire-format refresh token

    @return {Object} - { success, access_token, refresh_token, session, error }
    *********************************************************************/
    refreshSessionJwt: async function (instance, options) {

      if (CONFIG.ENABLE_JWT !== true) {
        throw new Error('[js-server-helper-auth] refreshSessionJwt requires CONFIG.ENABLE_JWT=true');
      }

      Validators.validateRefreshSessionJwtOptions(options);

      const now = instance.time;

      // Parse the wire format using the same parser as auth_id
      const parts = AuthId.parseAuthId(options.refresh_token);
      if (parts === null) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: CONFIG.ERRORS.INVALID_TOKEN
        };
      }

      // Locate the session record using the same listSessionsByActor
      // path used elsewhere in the module. Sessions per actor are
      // capped via LIMITS.total_max so the linear scan is bounded.
      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        parts.actor_id
      );

      if (list_result.success === false) {
        Lib.Debug.debug('Auth refreshSessionJwt: store list failed', { error: list_result.error });
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: CONFIG.ERRORS.SERVICE_UNAVAILABLE
        };
      }

      const target = list_result.records.find(function (r) {
        return r.token_key === parts.token_key;
      });

      if (
        Lib.Utils.isNullOrUndefined(target) ||
        target.actor_type !== CONFIG.ACTOR_TYPE
      ) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: CONFIG.ERRORS.INVALID_TOKEN
        };
      }

      if (target.expires_at < now) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: CONFIG.ERRORS.SESSION_EXPIRED
        };
      }

      // Verify the refresh secret hash. Constant-time comparison via
      // hex-string equality is acceptable since the values are uniform-
      // length SHA-256 hex; hex equality is not constant-time, but the
      // attacker cannot adaptively craft secrets without knowing salt.
      const provided_hash = Jwt.hashRefreshToken(parts.token_secret);
      if (
        Lib.Utils.isNullOrUndefined(target.refresh_token_hash) ||
        provided_hash !== target.refresh_token_hash
      ) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: CONFIG.ERRORS.INVALID_TOKEN
        };
      }

      // Rotate: generate a new refresh secret, persist its hash, also
      // roll the session lifecycle forward.
      const new_refresh_plaintext = Jwt.generateRefreshToken();
      const new_refresh_hash = Jwt.hashRefreshToken(new_refresh_plaintext);

      const update_result = await store.updateSessionActivity(
        instance,
        options.tenant_id,
        parts.actor_id,
        parts.token_key,
        {
          refresh_token_hash: new_refresh_hash,
          last_active_at: now,
          expires_at: now + CONFIG.TTL_SECONDS
        }
      );

      if (update_result.success === false) {
        Lib.Debug.debug('Auth refreshSessionJwt: rotation update failed', { error: update_result.error });
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: CONFIG.ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Rebuild the in-memory record with the rotated state so the JWT
      // signed below carries the freshest exp + iat.
      const rotated_record = Object.assign({}, target, {
        refresh_token_hash: new_refresh_hash,
        last_active_at: now,
        expires_at: now + CONFIG.TTL_SECONDS
      });

      const access_token = Jwt.signSessionJwt({
        session: rotated_record,
        signing_key: CONFIG.JWT.signing_key,
        issuer: CONFIG.JWT.issuer,
        audience: CONFIG.JWT.audience,
        access_token_ttl_seconds: CONFIG.JWT.access_token_ttl_seconds,
        now: now
      });

      const refresh_token = parts.actor_id + '-' + parts.token_key + '-' + new_refresh_plaintext;

      return {
        success: true,
        access_token: access_token,
        refresh_token: refresh_token,
        session: rotated_record,
        error: null
      };

    }

  };//////////////////////////// Public Functions END ///////////////////////////


  return Auth;

};/////////////////////////// createInterface END /////////////////////////////



///////////////////////// Background helpers START ////////////////////////////

/********************************************************************
Schedule a fire-and-forget refresh of last_active_at + expires_at on
the session record. Runs in parallel with the request's response so
the user doesn't wait on a DB write that doesn't affect the result.

@param {Object} args
@param {Object} args.Lib - Dependency container
@param {Object} args.store - The store interface
@param {Object} args.instance - Request instance
@param {Object} args.record - The session record to refresh
@param {Integer} args.ttl_seconds - The actor's TTL
@param {Object} args.options - The verifySession options (for tenant_id)

@return {void}
*********************************************************************/
const scheduleBackgroundRefresh = function (args) {

  const Lib = args.Lib;
  const store = args.store;
  const instance = args.instance;
  const record = args.record;

  // Tell the instance lifecycle that a parallel routine is starting
  const completeBackgroundRoutine = Lib.Instance.backgroundRoutine(instance);

  const updates = {
    last_active_at: instance.time,
    expires_at: instance.time + args.ttl_seconds
  };

  // Run the update in the background; signal completion in finally
  store.updateSessionActivity(
    instance,
    args.options.tenant_id,
    record.actor_id,
    record.token_key,
    updates
  )
    .then(function (update_result) {
      if (update_result.success === false) {
        Lib.Debug.debug('Auth background refresh failed (ignored)', {
          tenant_id: args.options.tenant_id,
          actor_id: record.actor_id,
          token_key: record.token_key,
          error: update_result.error
        });
      }
    })
    .catch(function (error) {
      Lib.Debug.debug('Auth background refresh threw (ignored)', {
        tenant_id: args.options.tenant_id,
        actor_id: record.actor_id,
        token_key: record.token_key,
        error: error.message
      });
    })
    .finally(function () {
      completeBackgroundRoutine();
    });

};

////////////////////////// Background helpers END /////////////////////////////
