// Info: Public export surface for Contact model module
// Dependencies: none (independent, referenced by User, Survey)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_override) {

  // Merge domain config with env overrides
  const ContactConfig = Object.assign(
    {},
    require('./contact.config'),
    config_override || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const ContactErrors = require('./contact.errors');

  // Load sub-modules with merged module-specific config
  const ContactData = require('./contact.data')(shared_libs, ContactConfig);
  const ContactProcess = require('./contact.process')(shared_libs, ContactConfig);
  const ContactValidation = require('./contact.validation')(shared_libs, ContactConfig, ContactErrors);


  // Return Public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only (passed to server layers)
  return {
    data: ContactData,
    errors: ContactErrors,
    process: ContactProcess,
    validation: ContactValidation,
    _config: ContactConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
