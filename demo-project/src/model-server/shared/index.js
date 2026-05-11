// Info: Server-only extensions for Shared module
// Dependencies: none (may reference any entity via Lib)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation, _config }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_module) {

  // Merge domain config with env overrides
  const SharedConfig = Object.assign(
    {},
    require('./shared.config'),
    config_module || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const SharedErrors = require('./shared.errors')();

  // Load sub-modules with merged module-specific config
  const SharedData = require('./shared.data')(shared_libs, SharedConfig);
  const SharedProcess = require('./shared.process')(shared_libs, SharedConfig);
  const SharedValidation = require('./shared.validation')(shared_libs, SharedConfig, SharedErrors);


  // Return Public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only (passed to server layers)
  return {
    data: SharedData,
    errors: SharedErrors,
    process: SharedProcess,
    validation: SharedValidation,
    _config: SharedConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
