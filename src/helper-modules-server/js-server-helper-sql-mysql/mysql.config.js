// Info: Default configuration for js-server-helper-mysql.
// Pure defaults. The loader merges overrides on top. No process.env access here.
'use strict';


module.exports = {

  // ---- Connection ----
  // Hostname or IP of the MySQL server.
  // For managed services, use the cluster / writer / reader endpoint.
  HOST: 'localhost',

  // MySQL port. Default is 3306.
  PORT: 3306,

  // Database name. Must exist on the server.
  DATABASE: '',

  // Username used for authentication.
  USER: 'root',

  // Password used for authentication.
  PASSWORD: '',

  // ---- SSL / TLS ----
  // false  - SSL disabled (local / docker testing)
  // true   - SSL enabled with default { rejectUnauthorized: true }
  // Object - Custom SSL options passed to mysql2
  //          e.g. { ca: fs.readFileSync('ca.pem'), rejectUnauthorized: true }
  // Required for managed databases (TLS enforced) in production.
  SSL: false,

  // ---- Connection Pool ----
  // Maximum number of connections held in the pool.
  // Sizing guide:
  //   Serverless function (Lambda, Cloud Function) - 1 (one request per invocation)
  //   Persistent server (Docker, EC2, VM)          - 10 to 20 (tune for concurrency)
  POOL_MAX: 10,

  // Max number of queued connection requests once the pool is full.
  // 0 means unlimited (wait forever for a free connection).
  POOL_QUEUE_LIMIT: 0,

  // How long an idle connection stays before it is closed and removed.
  // Serverless functions: lower value (e.g. 30000) helps avoid stale sockets
  // after the runtime freezes. Persistent servers can keep this higher to
  // hold connections warm.
  POOL_IDLE_TIMEOUT_MS: 60000,

  // ---- TCP Keep-Alive ----
  // Delay before the first TCP keepalive probe is sent on an idle connection.
  // Prevents load balancers / NAT gateways from silently dropping connections.
  // Keep this lower than POOL_IDLE_TIMEOUT_MS for serverless/managed deployments.
  KEEP_ALIVE_INITIAL_DELAY_MS: 10000,

  // ---- Query Behaviour ----
  // Allow multiple statements per query() call, separated by semicolons.
  // SECURITY: only enable if every SQL input is trusted - injection risk is magnified.
  MULTIPLE_STATEMENTS: false,

  // Connection character set. utf8mb4 covers full Unicode including emoji.
  // Change only if the database uses a different charset.
  CHARSET: 'utf8mb4',

  // Connection timezone. 'Z' is UTC, 'local' follows the server timezone.
  // Should match how timestamps are stored or MySQL will convert them on reads.
  TIMEZONE: 'Z',

  // How long to wait for the initial TCP connection before giving up.
  // Raise this for cross-region connections or slow networks.
  CONNECT_TIMEOUT_MS: 10000,

  // ---- Shutdown ----
  // How long close() waits for active queries to finish before force-destroying
  // the pool. Raise for long-running analytics queries; lower for snappy
  // container shutdown.
  CLOSE_TIMEOUT_MS: 5000

};
