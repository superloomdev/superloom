// Info: Configuration defaults for js-server-helper-auth.
// Most fields are required at construction time and validated by the loader.
// One actor_type per loader call. Keys with a default of `null` mean "must
// be supplied by the project" - the loader throws if they are still null.
'use strict';


module.exports = {

  // Storage backend selector. One of: 'memory', 'postgres', 'mysql', 'sqlite',
  // 'dynamodb', 'mongodb'. The 'memory' store is for tests only.
  // Required.
  STORE: null,

  // Per-store configuration. Shape varies by STORE - the chosen store's
  // factory validates its own required keys.
  //   memory:    {}                                                  (no config)
  //   postgres:  { table_name: 'sessions_user', lib_sql: Lib.Postgres }
  //   mysql:     { table_name: 'sessions_user', lib_sql: Lib.MySQL }
  //   sqlite:    { table_name: 'sessions_user', lib_sql: Lib.SQLite }
  //   dynamodb:  { table_name: 'sessions_user', lib_dynamodb: Lib.DynamoDB }
  //   mongodb:   { collection_name: 'sessions_user', lib_mongodb: Lib.MongoDB }
  // Required.
  STORE_CONFIG: null,

  // The actor_type this instance owns. Stamped onto every record (defense
  // in depth) and verified on every read. One instance = one actor_type.
  // Required.
  ACTOR_TYPE: null,

  // Session lifetime in seconds. expires_at = now + TTL_SECONDS at creation
  // and rolls forward by TTL_SECONDS on each throttled refresh.
  // Default: 30 days. Override per actor (e.g., 1 day for admins).
  TTL_SECONDS: 2592000,

  // Throttle window for last_active_at + client_* + expires_at refresh.
  // verifySession only writes back to the store once this many seconds have
  // elapsed since the last refresh, to avoid one DB write per request.
  // Default: 10 minutes.
  LAST_ACTIVE_UPDATE_INTERVAL_SECONDS: 600,

  // Limit policy. Enforced by the list-then-filter algorithm in parts/policy.js.
  LIMITS: {
    // Hard cap on total active sessions for one actor. Required >= 1.
    total_max: 20,

    // Per-form_factor cap. null = unlimited per form_factor.
    // Partial maps are allowed: { mobile: 3 } caps mobile only.
    by_form_factor_max: null,

    // Per-platform cap. null = unlimited per platform.
    // Partial maps are allowed: { ios: 2, android: 2 }.
    by_platform_max: null,

    // When a cap is hit:
    //   true  -> evict the LRU session within the violated tier (default)
    //   false -> reject the createSession call with LIMIT_REACHED
    // Same-installation replacement always runs first, regardless of this flag.
    evict_oldest_on_limit: true
  },

  // JWT mode toggle. When false (default), sessions are validated against
  // the database on every verifySession call. When true, the module also
  // mints/verifies signed access JWTs and uses a long-lived refresh token
  // (opaque, hash-stored). Refresh tokens are rotated on every refresh.
  ENABLE_JWT: false,

  // JWT settings. Only consulted when ENABLE_JWT: true.
  // signing_key, issuer, audience are required when JWT is on.
  // The signing_key must be at least 32 chars for HS256 security.
  JWT: {
    signing_key: null,
    algorithm: 'HS256',                   // HMAC-SHA256 via Node's native crypto
    issuer: null,
    audience: null,
    access_token_ttl_seconds: 900,        // 15 minutes
    refresh_token_ttl_seconds: 2592000,   // 30 days
    rotate_refresh_token: true            // RFC 6819 best practice
  },

  // Cookie name prefix. The full cookie name is
  // `${COOKIE_PREFIX}${tenant_id}` so multiple tenants on one domain
  // don't collide.
  // Required when reading/writing cookies.
  COOKIE_PREFIX: null,

  // Cookie attributes applied to every Set-Cookie written by this instance.
  COOKIE_OPTIONS: {
    http_only: true,
    secure: true,
    same_site: 'lax',
    path: '/'
  },

  // Domain error catalog. The module returns these objects verbatim on every
  // failure path so the application can pass-through with
  // `if (!result.success) return result;` without inspecting error.type.
  // The keys correspond to fixed failure paths inside this module. Values
  // are whatever shape your app uses (typically `{ code, message, status }`).
  // Required - validated at construction.
  ERRORS: null

};
