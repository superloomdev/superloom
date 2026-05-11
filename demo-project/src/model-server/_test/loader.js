// Info: Simulating Loader for Model-Server Testing
// Loads base models + server extensions with proper merge pattern
// Mimics the production server loader for isolated testing
'use strict';


////////////////////////////// Module Exports START //////////////////////////////
module.exports = function() {

  // Initialise shared libraries object
  const Lib = {};


  /////////////////////////// HELPER MODULES START /////////////////////////////

  // Load core helper modules
  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, {});


  /////////////////////////// ENTITY NAMESPACES START ////////////////////////////

  // Load model packages (non-executed; each entity executed individually)
  const Models = require('../../model');
  const ModelsExtended = require('..');

  // Contact: no server extensions
  Lib.Contact = require('../../model/contact')(Lib, {});

  // User: no server extensions
  Lib.User = require('../../model/user')(Lib, {});

  // Survey: has server extensions
  const SurveyModel = Models.Survey(Lib, {});
  Lib.Survey = {
    data: SurveyModel.data,
    errors: SurveyModel.errors,
    process: SurveyModel.process,
    validation: SurveyModel.validation
  };
  const SurveyModelExtended = ModelsExtended.Survey(Lib, {});
  Lib.Survey = {
    data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
    errors: { ...Lib.Survey.errors, ...SurveyModelExtended.errors },
    process: { ...Lib.Survey.process, ...SurveyModelExtended.process },
    validation: { ...Lib.Survey.validation, ...SurveyModelExtended.validation }
  };

  // Shared: has server extensions
  const SharedModel = Models.Shared(Lib, {});
  Lib.Shared = {
    data: SharedModel.data,
    errors: SharedModel.errors,
    process: SharedModel.process,
    validation: SharedModel.validation,
    config: SharedModel.config
  };
  const SharedModelExtended = ModelsExtended.Shared(Lib, {});
  Lib.Shared = {
    data: { ...Lib.Shared.data, ...SharedModelExtended.data },
    errors: { ...Lib.Shared.errors, ...SharedModelExtended.errors },
    process: { ...Lib.Shared.process, ...SharedModelExtended.process },
    validation: { ...Lib.Shared.validation, ...SharedModelExtended.validation },
    config: Lib.Shared.config
  };


  /////////////////////////// RETURN LIB START /////////////////////////////////

  // Return fully loaded Lib for testing
  return Lib;

};///////////////////////////// Module Exports END /////////////////////////////
