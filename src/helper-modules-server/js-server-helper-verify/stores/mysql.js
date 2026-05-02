// Info: MySQL backend for the verify module. Thin wrapper over
// `sql-common.js` with the mysql dialect locked in.
'use strict';

const sqlStoreFactory = require('./sql-common');

module.exports = function mysqlStoreFactory (Lib, store_config) {
  return sqlStoreFactory(Lib, 'mysql', store_config);
};
