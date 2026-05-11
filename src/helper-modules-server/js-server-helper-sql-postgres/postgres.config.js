// Info: Default configuration for js-server-helper-postgres.
// Pure defaults — the loader merges overrides on top of this. No process.env access here.
'use strict';


module.exports = {

  // ---- Connection ----
  HOST: 'localhost',
  PORT: 5432,
  DATABASE: '',
  USER: 'postgres',
  PASSWORD: '',

  // ---- SSL ----
  // false            — disabled (local / docker)
  // true             — enabled with default { rejectUnauthorized: true }
  // Object           — passed through to pg (e.g. { ca: <pem>, rejectUnauthorized: true })
  SSL: false,

  // ---- Pooling ----
  // Sizing guide:
  //   Lambda         — POOL_MAX: 1           (one invocation = one connection)
  //   Docker / EC2   — POOL_MAX: 10 to 20    (tune per instance count × DB max_connections)
  POOL_MAX: 10,
  POOL_MIN: 0,
  POOL_IDLE_TIMEOUT_MS: 60000,

  // ---- Connection keep-alive ----
  KEEP_ALIVE_INITIAL_DELAY_MS: 10000,

  // ---- Driver behaviour ----
  CONNECT_TIMEOUT_MS: 10000,
  STATEMENT_TIMEOUT_MS: 0,
  APPLICATION_NAME: 'superloom',

  // ---- Shutdown ----
  // How long close() waits for active queries to finish before force-destroying
  // the pool. Raise for long-running analytics queries; lower for snappy
  // container shutdown.
  CLOSE_TIMEOUT_MS: 5000

};
