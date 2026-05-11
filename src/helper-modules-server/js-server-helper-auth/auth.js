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
//     detachDeviceFromSession, setupNewStore, cleanupExpiredSessions,
//     createAuthId, parseAuthId
//   - JWT-mode (ENABLE_JWT=true) extends the surface with: verifyJwt,
//     signSessionJwt, refreshSessionJwt. createSession additionally
//     returns access_token + refresh_token in this mode.
//
// Schema management: setupNewStore is supported only on SQL backends
// (sqlite, postgres, mysql) - it issues idempotent CREATE TABLE +
// CREATE INDEX. NoSQL backends (mongodb, dynamodb) return NOT_IMPLEMENTED;
// provision those out-of-band until the underlying helpers gain schema APIs.
//
// Storage backends are provided by standalone adapter packages. The caller
// passes the chosen store factory directly as CONFIG.STORE - no string
// dispatch inside this module. Require only the adapter you need:
//   js-server-helper-auth-store-sqlite
//   js-server-helper-auth-store-postgres
//   js-server-helper-auth-store-mysql
//   js-server-helper-auth-store-mongodb
//   js-server-helper-auth-store-dynamodb
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

  // Internal error catalog (frozen)
  const ERRORS = require('./auth.errors');

  // Singleton validators: config + options validators in one place.
  // validateConfig runs immediately so misconfiguration fails fast at startup.
  const Validators = require('./auth.validators')(Lib);
  Validators.validateConfig(CONFIG);

  // Instantiate the store. CONFIG.STORE is the factory function passed in
  // by the caller; it extracts its own slice from CONFIG.STORE_CONFIG.
  const store = CONFIG.STORE(Lib, CONFIG, ERRORS);

  // Construct internal parts. Every parts factory takes the uniform
  // (Lib, CONFIG, ERRORS) signature so a new part can be added without
  // touching this loader. Parts that need another part (today only
  // token-source needing cookie) self-require it; this loader treats
  // them as opaque, independent factories.
  const Parts = {
    RecordShape: require('./parts/record-shape')(Lib, CONFIG, ERRORS),
    AuthId: require('./parts/auth-id')(Lib, CONFIG, ERRORS),
    Policy: require('./parts/policy')(Lib, CONFIG, ERRORS),
    Cookie: require('./parts/cookie')(Lib, CONFIG, ERRORS),
    TokenSource: require('./parts/token-source')(Lib, CONFIG, ERRORS),
    Jwt: require('./parts/jwt')(Lib, CONFIG, ERRORS)
  };

  // Build the public interface, closing over Lib, CONFIG, ERRORS,
  // Validators, store, and Parts.
  return createInterface(Lib, CONFIG, ERRORS, Validators, store, Parts);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Build the public interface. All public functions close over the parts
and CONFIG passed in - no module-level mutable state.

@param {Object} Lib        - Dependency container
@param {Object} CONFIG     - Merged configuration
@param {Object} ERRORS     - Error catalog for this module
@param {Object} Validators - Singleton validators from auth.validators.js
@param {Object} store      - Resolved storage backend interface
@param {Object} Parts      - Constructed parts (RecordShape, AuthId, ...)

@return {Object} - The public Auth interface
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, Validators, store, Parts) {

  const RecordShape = Parts.RecordShape;
  const AuthId = Parts.AuthId;
  const Policy = Parts.Policy;
  const Cookie = Parts.Cookie;
  const TokenSource = Parts.TokenSource;
  const Jwt = Parts.Jwt;


  ////////////////////////////// Public Functions START ////////////////////////
  const Auth = {


    // ~~~~~~~~~~~~~~~~~~~~ Session Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Create / verify / remove sessions for the current actor.

    /********************************************************************
    Create a new session for an actor. Enforces tier limits + same-install
    replacement via the list-then-filter algorithm. Stamps a Set-Cookie
    on the response if instance.http_response is present.

    @param {Object} instance - Request instance (provides time + lifecycle)
    @param {Object} options - See parts/validators.js validateCreateSessionOptions

    @return {Promise<Object>} - { success, auth_id, session, error }
    *********************************************************************/
    createSession: async function (instance, options) {

      // Validate inputs; throws TypeError on any violation
      Validators.validateCreateSessionOptions(options);

      // Snapshot request time so all timestamps in this call are consistent
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

      // Return a service error if the store list failed
      if (list_result.success === false) {
        Lib.Debug.debug('Auth createSession: store list failed', { error: list_result.error });
        return {
          success: false,
          auth_id: null,
          session: null,
          error: ERRORS.SERVICE_UNAVAILABLE
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

      // Reject immediately if the policy says the limit is reached
      if (decision.decision === 'reject') {
        return {
          success: false,
          auth_id: null,
          session: null,
          error: ERRORS.LIMIT_REACHED
        };
      }

      // Delete any sessions the policy queued for removal (same-install
      // replacements + LRU evictions)
      if (decision.to_delete.length > 0) {

        const delete_keys = decision.to_delete.map(function (session) {
          return {
            actor_id: session.actor_id,
            token_key: session.token_key
          };
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
            error: ERRORS.SERVICE_UNAVAILABLE
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
          error: ERRORS.SERVICE_UNAVAILABLE
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

      // Return the new session and wire-format credentials
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

      // Validate inputs and normalise to a safe options object
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

      // Reject immediately if no auth_id could be resolved
      if (Lib.Utils.isNullOrUndefined(auth_id)) {
        return {
          success: false,
          session: null,
          error: ERRORS.INVALID_TOKEN
        };
      }

      // Parse the wire format
      const parts = AuthId.parseAuthId(auth_id);
      // Reject if the wire format is malformed
      if (parts === null) {
        return {
          success: false,
          session: null,
          error: ERRORS.INVALID_TOKEN
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

      // Look up the session record by composite key + secret hash
      const get_result = await store.getSession(
        instance,
        safe_options.tenant_id,
        parts.actor_id,
        parts.token_key,
        token_secret_hash
      );

      // Return a service error if the store read failed
      if (get_result.success === false) {
        Lib.Debug.debug('Auth verifySession: store read failed', { error: get_result.error });
        return {
          success: false,
          session: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Token not found - treat as invalid rather than exposing absence
      if (get_result.record === null) {
        return {
          success: false,
          session: null,
          error: ERRORS.INVALID_TOKEN
        };
      }

      // Unpack the record for the checks below
      const record = get_result.record;

      // Lifecycle check
      if (record.expires_at < instance.time) {
        return {
          success: false,
          session: null,
          error: ERRORS.SESSION_EXPIRED
        };
      }

      // Layer-2 actor_type defense: the record came from a per-actor_type
      // table, but if a project ever points two instances at the same
      // table by mistake, we catch the mismatch here.
      if (record.actor_type !== CONFIG.ACTOR_TYPE) {
        return {
          success: false,
          session: null,
          error: ERRORS.ACTOR_TYPE_MISMATCH
        };
      }

      // Throttled refresh: if the last activity update is older than
      // the configured interval, fire a background write.
      if ((instance.time - record.last_active_at) >= CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS) {

        _Auth.scheduleBackgroundRefresh(instance, record, CONFIG.TTL_SECONDS, safe_options.tenant_id);

      }

      // Hydrate the request instance
      instance.session = record;

      // Return the verified session
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

      // Validate inputs; throws TypeError on any violation
      Validators.validateRemoveSessionOptions(options);

      // Delete the session record from the store
      const result = await store.deleteSession(
        instance,
        options.tenant_id,
        options.actor_id,
        options.token_key
      );

      // Return a service error if the delete failed
      if (result.success === false) {
        Lib.Debug.debug('Auth removeSession: store delete failed', { error: result.error });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
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

      // Report success
      return {
        success: true,
        error: null
      };

    },


    /********************************************************************
    Remove all sessions for an actor except the one whose token_key is
    identified by keep_token_key. Used for "log out everywhere else".

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, keep_token_key }

    @return {Promise<Object>} - { success, removed_count, error }
    *********************************************************************/
    removeOtherSessions: async function (instance, options) {

      // Validate inputs; throws TypeError on any violation
      Validators.validateRemoveOtherSessionsOptions(options);

      // Load all sessions for this actor to identify which to delete
      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      // Return a service error if the store list failed
      if (list_result.success === false) {
        return {
          success: false,
          removed_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Exclude the session the caller wants to keep
      const targets = list_result.records.filter(function (session) {
        return session.token_key !== options.keep_token_key;
      });

      // Nothing to delete - return early
      if (targets.length === 0) {
        return {
          success: true,
          removed_count: 0,
          error: null
        };
      }

      // Build the minimal key list required by the bulk-delete store call
      const delete_keys = targets.map(function (session) {
        return {
          actor_id: session.actor_id,
          token_key: session.token_key
        };
      });

      // Delete the targeted sessions and return the count
      const delete_result = await store.deleteSessions(instance, options.tenant_id, delete_keys);
      if (delete_result.success === false) {
        return {
          success: false,
          removed_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report how many sessions were removed
      return {
        success: true,
        removed_count: targets.length,
        error: null
      };

    },


    /********************************************************************
    Delete all sessions for an actor. Used for password reset and
    forced re-auth.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, removed_count, error }
    *********************************************************************/
    removeAllSessions: async function (instance, options) {

      // Validate inputs; throws TypeError on any violation
      Validators.validateActorScopedOptions(options, 'removeAllSessions');

      // Load all sessions for this actor so we have the full key list
      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      // Return a service error if the store list failed
      if (list_result.success === false) {
        return {
          success: false,
          removed_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Nothing to delete - return early
      if (list_result.records.length === 0) {
        return {
          success: true,
          removed_count: 0,
          error: null
        };
      }

      // Build the minimal key list required by the bulk-delete store call
      const delete_keys = list_result.records.map(function (session) {
        return {
          actor_id: session.actor_id,
          token_key: session.token_key
        };
      });

      // Delete all sessions for the actor
      const delete_result = await store.deleteSessions(instance, options.tenant_id, delete_keys);
      if (delete_result.success === false) {
        return {
          success: false,
          removed_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
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

      // Report how many sessions were removed
      return {
        success: true,
        removed_count: list_result.records.length,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Session Reads ~~~~~~~~~~~~~~~~~~~~
    // Read-only listing and counting for the current actor.

    /********************************************************************
    List all sessions for an actor. The classic "Active devices" UI
    backend. Does not modify state.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, sessions, error }
    *********************************************************************/
    listSessions: async function (instance, options) {

      // Validate inputs; throws TypeError on any violation
      Validators.validateActorScopedOptions(options, 'listSessions');

      // Load all sessions for this actor from the store
      const list_result = await store.listSessionsByActor(
        instance,
        options.tenant_id,
        options.actor_id
      );

      // Return a service error if the store list failed
      if (list_result.success === false) {
        return {
          success: false,
          sessions: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Filter expired sessions client-side - they will be cleaned up later
      const now = instance.time;
      const active = list_result.records.filter(function (session) {
        return session.expires_at > now;
      });

      // Return only the non-expired sessions
      return {
        success: true,
        sessions: active,
        error: null
      };

    },


    /********************************************************************
    Count active sessions for an actor. Convenience wrapper over
    listSessions for callers that need only a number.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id }

    @return {Promise<Object>} - { success, count, error }
    *********************************************************************/
    countSessions: async function (instance, options) {

      // Delegate to listSessions which already handles validation and expiry filtering
      const list = await Auth.listSessions(instance, options);
      if (list.success === false) {
        return {
          success: false,
          count: 0,
          error: list.error
        };
      }

      // Return the count of active sessions
      return {
        success: true,
        count: list.sessions.length,
        error: null
      };

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

      // Validate inputs; throws TypeError on any violation
      Validators.validateActorScopedOptions(options, 'listPushTargetsByActor');

      // Load active sessions via listSessions (handles expiry filtering)
      const list = await Auth.listSessions(instance, options);
      if (list.success === false) {
        return {
          success: false,
          targets: null,
          error: list.error
        };
      }

      // Keep only sessions with a fully-configured push target
      const targets = list.sessions.filter(function (s) {
        return (
          !Lib.Utils.isNullOrUndefined(s.push_provider) &&
          !Lib.Utils.isNullOrUndefined(s.push_token) &&
          !Lib.Utils.isEmptyString(s.push_provider) &&
          !Lib.Utils.isEmptyString(s.push_token)
        );
      });

      // Return the push-ready sessions
      return {
        success: true,
        targets: targets,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Device Binding ~~~~~~~~~~~~~~~~~~~~
    // Attach / detach the per-session push provider + token.

    /********************************************************************
    Bind a push provider + token to an existing session. Called after
    the client app obtains push permission from the OS / browser.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, token_key, push_provider, push_token }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    attachDeviceToSession: async function (instance, options) {

      // Validate inputs; throws TypeError on any violation
      Validators.validateAttachDeviceOptions(options);

      // Write the push provider and token onto the session record
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

      // Return a service error if the store write failed
      if (result.success === false) {
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success
      return {
        success: true,
        error: null
      };

    },


    /********************************************************************
    Unbind the push provider + token from a session. Called when the OS
    revokes the token, or the client opts out of push.

    @param {Object} instance - Request instance
    @param {Object} options - { tenant_id, actor_id, token_key }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    detachDeviceFromSession: async function (instance, options) {

      // Validate inputs; throws TypeError on any violation
      Validators.validateDetachDeviceOptions(options);

      // Null out the push fields on the session record
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

      // Return a service error if the store write failed
      if (result.success === false) {
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Schema & Maintenance ~~~~~~~~~~~~~~~~~~~~
    // One-shot DB schema setup (SQL backends only) and the cron-driven
    // sweep that purges expired rows.

    /********************************************************************
    Idempotent backend schema setup. SQL backends (sqlite, postgres,
    mysql) issue CREATE TABLE IF NOT EXISTS plus CREATE INDEX
    IF NOT EXISTS for the expires_at index in a single call. Safe to
    run on every boot.

    NoSQL backends (mongodb, dynamodb) do not implement this method -
    schema setup (collections, tables, secondary indexes, native TTL)
    must be provisioned out-of-band via infra-as-code or a one-shot
    script using the underlying helper module. Calling setupNewStore
    on a NoSQL backend throws TypeError; the caller picks the backend
    at config time and is expected to know what it supports.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Backend capability gate. Throws TypeError on NoSQL stores so
      // the misuse surfaces at first call rather than masquerading as
      // a generic envelope error.
      if (!Lib.Utils.isFunction(store.setupNewStore)) {
        throw new TypeError(
          '[js-server-helper-auth] setupNewStore is not supported by store "' +
          CONFIG.STORE + '" - provision the schema out-of-band'
        );
      }

      // Delegate to the store's own idempotent schema setup
      return await store.setupNewStore(instance);

    },


    /********************************************************************
    Sweep expired sessions. Optional - only useful for SQL backends
    without native TTL. Recommended frequency: once per day via cron.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      // Every shipped store implements cleanupExpiredSessions. The check
      // here would only trip on a future broken store, which is a
      // programmer error - throw so it surfaces in dev/CI rather than
      // leaking a synthetic envelope error to the caller.
      if (!Lib.Utils.isFunction(store.cleanupExpiredSessions)) {
        throw new Error(
          '[js-server-helper-auth] store "' + CONFIG.STORE +
          '" does not implement cleanupExpiredSessions'
        );
      }

      // Delegate to the store; catch raw driver throws and wrap in an envelope
      try {
        return await store.cleanupExpiredSessions(instance);
      } catch (err) {
        // Log the raw driver error and return a service-unavailable envelope
        Lib.Debug.debug('Auth cleanupExpiredSessions threw', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_message: err && err.message,
          driver_code: err && err.code,
          driver_stack: err && err.stack
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

    },


    // ~~~~~~~~~~~~~~~~~~~~ Auth ID Helpers ~~~~~~~~~~~~~~~~~~~~
    // Pure helpers for building / parsing the wire-format auth_id.

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


    // ~~~~~~~~~~~~~~~~~~~~ JWT Mode ~~~~~~~~~~~~~~~~~~~~
    // Stateless verify, mint, and refresh - active only when
    // ENABLE_JWT=true. Each call throws if JWT mode is off.

    /********************************************************************
    Stateless JWT verification. Decodes + verifies the signature and
    standard claims (iat / exp / iss / aud) without any DB read. Use
    this on every authenticated request when JWT mode is enabled - the
    DB is consulted only on /refresh.

    Returns either the verified claims or one of the standard auth
    errors mapped from ERRORS.

    @param {Object} instance - Request instance
    @param {Object} options
    @param {String} options.jwt - Compact JWS string (access token)

    @return {Object} - { success, claims, error }
    *********************************************************************/
    verifyJwt: function (instance, options) {

      // Guard: this method is inert unless JWT mode is enabled
      if (CONFIG.ENABLE_JWT !== true) {
        throw new Error('[js-server-helper-auth] verifyJwt requires CONFIG.ENABLE_JWT=true');
      }

      // instance is accepted for API consistency but not used in stateless verify
      void instance;

      // Verify the compact JWS string against the configured key and claims
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
            error: ERRORS.ACTOR_TYPE_MISMATCH
          };
        }

        // Return the verified claims on success
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
        domain_error = ERRORS.SESSION_EXPIRED;
        break;
      case 'MALFORMED':
      case 'BAD_ALG':
      case 'BAD_SIGNATURE':
      case 'BAD_ISSUER':
      case 'BAD_AUDIENCE':
      default:
        domain_error = ERRORS.INVALID_TOKEN;
        break;
      }

      // Return the mapped domain error
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

      // Guard: this method is inert unless JWT mode is enabled
      if (CONFIG.ENABLE_JWT !== true) {
        throw new Error('[js-server-helper-auth] signSessionJwt requires CONFIG.ENABLE_JWT=true');
      }

      // Sign and return a short-lived access JWT for the given session
      const access_token = Jwt.signSessionJwt({
        session: options.session,
        signing_key: CONFIG.JWT.signing_key,
        issuer: CONFIG.JWT.issuer,
        audience: CONFIG.JWT.audience,
        access_token_ttl_seconds: CONFIG.JWT.access_token_ttl_seconds,
        now: instance.time
      });

      // Return the signed access token
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

      // Guard: this method is inert unless JWT mode is enabled
      if (CONFIG.ENABLE_JWT !== true) {
        throw new Error('[js-server-helper-auth] refreshSessionJwt requires CONFIG.ENABLE_JWT=true');
      }

      // Validate inputs and snapshot request time
      Validators.validateRefreshSessionJwtOptions(options);

      // Snapshot request time so all timestamps in this call are consistent
      const now = instance.time;

      // Parse the wire format using the same parser as auth_id
      const parts = AuthId.parseAuthId(options.refresh_token);

      // Reject if the wire format is malformed
      if (parts === null) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: ERRORS.INVALID_TOKEN
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

      // Return a service error if the store list failed
      if (list_result.success === false) {
        Lib.Debug.debug('Auth refreshSessionJwt: store list failed', { error: list_result.error });
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Find the session matching this token_key and verify it belongs to this actor_type
      const target = list_result.records.find(function (r) {
        return r.token_key === parts.token_key;
      });

      // Reject if the session was not found or belongs to a different actor_type
      if (
        Lib.Utils.isNullOrUndefined(target) ||
        target.actor_type !== CONFIG.ACTOR_TYPE
      ) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: ERRORS.INVALID_TOKEN
        };
      }

      // Reject if the session has expired
      if (target.expires_at < now) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: ERRORS.SESSION_EXPIRED
        };
      }

      // Verify the refresh secret hash. Constant-time comparison via
      // hex-string equality is acceptable since the values are uniform-
      // length SHA-256 hex; hex equality is not constant-time, but the
      // attacker cannot adaptively craft secrets without knowing salt.
      const provided_hash = Jwt.hashRefreshToken(parts.token_secret);
      // Reject if the provided refresh secret does not match the stored hash
      if (
        Lib.Utils.isNullOrUndefined(target.refresh_token_hash) ||
        provided_hash !== target.refresh_token_hash
      ) {
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: ERRORS.INVALID_TOKEN
        };
      }

      // Rotate: generate a new refresh secret, persist its hash, also
      // roll the session lifecycle forward.
      const new_refresh_plaintext = Jwt.generateRefreshToken();
      const new_refresh_hash = Jwt.hashRefreshToken(new_refresh_plaintext);

      // Persist the rotated hash and slide the session lifecycle forward
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

      // Return a service error if the rotation write failed
      if (update_result.success === false) {
        Lib.Debug.debug('Auth refreshSessionJwt: rotation update failed', { error: update_result.error });
        return {
          success: false,
          access_token: null,
          refresh_token: null,
          session: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Rebuild the in-memory record with the rotated state so the JWT
      // signed below carries the freshest exp + iat.
      const rotated_record = Object.assign({}, target, {
        refresh_token_hash: new_refresh_hash,
        last_active_at: now,
        expires_at: now + CONFIG.TTL_SECONDS
      });

      // Sign a new short-lived access JWT carrying the rotated session state
      const access_token = Jwt.signSessionJwt({
        session: rotated_record,
        signing_key: CONFIG.JWT.signing_key,
        issuer: CONFIG.JWT.issuer,
        audience: CONFIG.JWT.audience,
        access_token_ttl_seconds: CONFIG.JWT.access_token_ttl_seconds,
        now: now
      });

      // Compose the new wire-format refresh token for the client
      const refresh_token = parts.actor_id + '-' + parts.token_key + '-' + new_refresh_plaintext;

      // Return the new token pair and the updated session record
      return {
        success: true,
        access_token: access_token,
        refresh_token: refresh_token,
        session: rotated_record,
        error: null
      };

    }

  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Auth = {


    /********************************************************************
    Schedule a fire-and-forget refresh of last_active_at + expires_at
    on the session record. Runs in parallel with the request's response
    so the user doesn't wait on a DB write that doesn't affect the result.
    Closes over Lib, store, and CONFIG from createInterface.

    @param {Object}  instance    - Request instance
    @param {Object}  record      - The session record to refresh
    @param {Integer} ttl_seconds - The actor's TTL
    @param {String}  tenant_id   - Tenant identifier for the store call

    @return {void}
    *********************************************************************/
    scheduleBackgroundRefresh: function (instance, record, ttl_seconds, tenant_id) {

      // Tell the instance lifecycle that a parallel routine is starting
      const completeBackgroundRoutine = Lib.Instance.backgroundRoutine(instance);

      // Build the field updates: slide both timestamps forward by ttl_seconds
      const updates = {
        last_active_at: instance.time,
        expires_at: instance.time + ttl_seconds
      };

      // Run the update in the background; signal completion in finally
      store.updateSessionActivity(
        instance,
        tenant_id,
        record.actor_id,
        record.token_key,
        updates
      )
        .then(function (update_result) {

          // Log store-level failures silently - background errors never surface to the caller
          if (update_result.success === false) {
            Lib.Debug.debug('Auth background refresh failed (ignored)', {
              tenant_id: tenant_id,
              actor_id: record.actor_id,
              token_key: record.token_key,
              error: update_result.error
            });
          }

        })
        .catch(function (error) {

          // Log raw driver throws silently - background errors never surface to the caller
          Lib.Debug.debug('Auth background refresh threw (ignored)', {
            tenant_id: tenant_id,
            actor_id: record.actor_id,
            token_key: record.token_key,
            error: error.message
          });

        })
        .finally(function () {

          // Signal the instance lifecycle that the background routine is complete
          completeBackgroundRoutine();

        });

    }


  };////////////////////////////// Private Functions END ///////////////////////


  return Auth;

};/////////////////////////// createInterface END /////////////////////////////
