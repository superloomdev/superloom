// Info: Postgres backend for the auth module. A thin wrapper around
// stores/sql-common.js that fixes the dialect to 'postgres'. The
// application provides Lib.Postgres through CONFIG.STORE_CONFIG.lib_sql
// - the auth module never requires the Postgres driver directly, so
// projects not using this store never load `pg`.
'use strict';


const buildSqlStore = require('./sql-common');


/********************************************************************
Factory for the Postgres store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_sql: Lib.Postgres }

@return {Object} - Store interface
*********************************************************************/
module.exports = function postgresStoreFactory (Lib, store_config) {

  return buildSqlStore(Lib, store_config, 'postgres');

};
