// Info: Config validator for js-server-helper-logger-store-postgres.
'use strict';

let Lib;

module.exports = function loader (shared_libs) {
  Lib = shared_libs;
  return Validators;
};

const Validators = {

  validateConfig: function (store_config) {

    if (
      Lib.Utils.isNullOrUndefined(store_config) ||
      !Lib.Utils.isObject(store_config)
    ) {
      throw new Error('[js-server-helper-logger-store-postgres] STORE_CONFIG must be an object');
    }

    if (
      Lib.Utils.isNullOrUndefined(store_config.table_name) ||
      !Lib.Utils.isString(store_config.table_name) ||
      Lib.Utils.isEmptyString(store_config.table_name)
    ) {
      throw new Error('[js-server-helper-logger-store-postgres] STORE_CONFIG.table_name is required');
    }

    if (Lib.Utils.isNullOrUndefined(store_config.lib_sql)) {
      throw new Error('[js-server-helper-logger-store-postgres] STORE_CONFIG.lib_sql is required (pass Lib.Postgres)');
    }

  }

};
