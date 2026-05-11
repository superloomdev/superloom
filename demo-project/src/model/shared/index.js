// Info: Public export surface for Shared model module
// Dependencies: none (aggregates cross-cutting concerns)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation, config }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_override) {

  // Merge domain config with env overrides
  const SharedConfig = Object.assign(
    {},
    require('./shared.config'),
    config_override || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const SharedErrors = require('./shared.errors');

  // Load sub-modules with merged module-specific config
  const SharedData = require('./shared.data')(shared_libs, SharedConfig);
  const SharedProcess = require('./shared.process')(shared_libs, SharedConfig);
  const SharedValidation = require('./shared.validation')(shared_libs, SharedConfig, SharedErrors);


  // Return Public APIs as object { data, errors, process, validation, config }
  // Note: shared module exports config (other modules may need it)
  return {
    data: SharedData,
    errors: SharedErrors,
    process: SharedProcess,
    validation: SharedValidation,
    config: SharedConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
