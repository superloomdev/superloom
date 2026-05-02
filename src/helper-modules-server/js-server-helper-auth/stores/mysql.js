// Info: MySQL backend for the auth module. A thin wrapper around
// stores/sql-common.js that fixes the dialect to 'mysql'. The
// application provides Lib.MySQL through CONFIG.STORE_CONFIG.lib_sql
// - the auth module never requires the MySQL driver directly, so
// projects not using this store never load `mysql2`.
'use strict';


const buildSqlStore = require('./sql-common');


/********************************************************************
Factory for the MySQL store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_sql: Lib.MySQL }

@return {Object} - Store interface
*********************************************************************/
module.exports = function mysqlStoreFactory (Lib, store_config) {

  return buildSqlStore(Lib, store_config, 'mysql');

};
