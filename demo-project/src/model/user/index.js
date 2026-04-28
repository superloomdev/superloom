// Info: Public export surface for User base model module
// Dependencies: Contact (uses Contact.validation for email/phone)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_override) {

  // Merge domain config with env overrides
  const UserConfig = Object.assign(
    {},
    require('./user.config'),
    config_override || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const UserErrors = require('./user.errors');

  // Load sub-modules with merged module-specific config
  const UserData = require('./user.data')(shared_libs, UserConfig);
  const UserProcess = require('./user.process')(shared_libs, UserConfig);
  const UserValidation = require('./user.validation')(shared_libs, UserConfig, UserErrors);


  // Return Public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only (passed to server layers)
  return {
    data: UserData,
    errors: UserErrors,
    process: UserProcess,
    validation: UserValidation,
    _config: UserConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
