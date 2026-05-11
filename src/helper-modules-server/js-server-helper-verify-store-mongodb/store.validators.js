// Info: Config validator for js-server-helper-verify-store-mongodb.
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
      throw new Error('[js-server-helper-verify-store-mongodb] STORE_CONFIG must be an object');
    }

    // collection_name is required and must be a non-empty string
    if (
      Lib.Utils.isNullOrUndefined(store_config.collection_name) ||
      !Lib.Utils.isString(store_config.collection_name) ||
      Lib.Utils.isEmptyString(store_config.collection_name)
    ) {
      throw new Error('[js-server-helper-verify-store-mongodb] STORE_CONFIG.collection_name is required');
    }

    // lib_mongodb is required - the caller must inject the MongoDB helper
    if (Lib.Utils.isNullOrUndefined(store_config.lib_mongodb)) {
      throw new Error('[js-server-helper-verify-store-mongodb] STORE_CONFIG.lib_mongodb is required (pass Lib.MongoDB)');
    }

  }

};////////////////////////////// Public Functions END ////////////////////////
