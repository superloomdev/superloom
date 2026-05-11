// Info: Config validator for js-server-helper-auth-store-postgres.
// Called once at construction time from the store.js loader.
// Throws Error on misconfiguration so the adapter fails before
// serving a single request.
//
// Singleton: Lib is injected once by the loader. Node.js require
// cache guarantees the same reference on every subsequent require.
'use strict';


// Shared dependency injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and returns the module-scope
Validators object.

@param {Object} shared_libs - Dependency container (Utils)

@return {Object} - Public Validators interface
*********************************************************************/
module.exports = function loader (shared_libs) {

  // Inject shared dependency
  Lib = shared_libs;

  return Validators;

};///////////////////////////// Module-Loader END ///////////////////////////////



////////////////////////////// Public Functions START ////////////////////////
const Validators = {


  /********************************************************************
  Validate the STORE_CONFIG object passed to the adapter loader.
  Throws on the first violation so misconfiguration surfaces
  immediately at boot time.

  @param {Object} store_config - The STORE_CONFIG value from CONFIG

  @return {void}
  *********************************************************************/
  validateConfig: function (store_config) {

    // STORE_CONFIG must be a non-null object
    if (
      Lib.Utils.isNullOrUndefined(store_config) ||
      !Lib.Utils.isObject(store_config)
    ) {
      throw new Error('[js-server-helper-auth-store-postgres] STORE_CONFIG must be an object');
    }

    // table_name is required and must be a non-empty string
    if (
      Lib.Utils.isNullOrUndefined(store_config.table_name) ||
      !Lib.Utils.isString(store_config.table_name) ||
      Lib.Utils.isEmptyString(store_config.table_name)
    ) {
      throw new Error('[js-server-helper-auth-store-postgres] STORE_CONFIG.table_name is required');
    }

    // lib_sql is required - the caller must inject the Postgres helper
    if (Lib.Utils.isNullOrUndefined(store_config.lib_sql)) {
      throw new Error('[js-server-helper-auth-store-postgres] STORE_CONFIG.lib_sql is required (pass Lib.Postgres)');
    }

  }

};////////////////////////////// Public Functions END ////////////////////////
