// Info: Client-only model extensions for Survey entity
// Dependencies: none (may reference Lib.Survey from base model)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation, _config }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_module) {

  // Merge domain config with env overrides
  const SurveyConfig = Object.assign(
    {},
    require('./survey.config'),
    config_module || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const SurveyErrors = require('./survey.errors');

  // Load sub-modules with merged module-specific config
  const SurveyData = require('./survey.data')(shared_libs, SurveyConfig);
  const SurveyProcess = require('./survey.process')(shared_libs, SurveyConfig);
  const SurveyValidation = require('./survey.validation')(shared_libs, SurveyConfig, SurveyErrors);


  // Return Public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only
  return {
    data: SurveyData,
    errors: SurveyErrors,
    process: SurveyProcess,
    validation: SurveyValidation,
    _config: SurveyConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
