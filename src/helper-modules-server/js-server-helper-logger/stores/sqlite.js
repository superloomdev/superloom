// Info: SQLite backend for the logger module. Thin wrapper over
// `sql-common.js` with the sqlite dialect locked in.
'use strict';

const sqlStoreFactory = require('./sql-common');

module.exports = function sqliteStoreFactory (Lib, store_config) {
  return sqlStoreFactory(Lib, 'sqlite', store_config);
};
