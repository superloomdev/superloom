// Info: SQLite backend for the auth module. A thin wrapper around
// stores/sql-common.js that fixes the dialect to 'sqlite'. The
// application provides Lib.SQLite through CONFIG.STORE_CONFIG.lib_sql
// - the auth module never requires the SQLite driver directly.
'use strict';


const buildSqlStore = require('./sql-common');


/********************************************************************
Factory for the SQLite store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_sql: Lib.SQLite }

@return {Object} - Store interface
*********************************************************************/
module.exports = function sqliteStoreFactory (Lib, store_config) {

  return buildSqlStore(Lib, store_config, 'sqlite');

};
