// Info: Postgres backend for the verify module. Thin wrapper over
// `sql-common.js` with the postgres dialect locked in.
'use strict';

const sqlStoreFactory = require('./sql-common');

module.exports = function postgresStoreFactory (Lib, store_config) {
  return sqlStoreFactory(Lib, 'postgres', store_config);
};
