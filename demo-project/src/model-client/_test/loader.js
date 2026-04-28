// Info: Simulating Loader for Model-Client Testing
// Loads base models + client extensions with proper merge pattern
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
  const ModelsClient = require('..');

  // Contact: no client extensions
  Lib.Contact = require('../../model/contact')(Lib, {});

  // User: no client extensions
  Lib.User = require('../../model/user')(Lib, {});

  // Survey: has client extensions
  const SurveyModel = Models.Survey(Lib, {});
  Lib.Survey = {
    data: SurveyModel.data,
    errors: SurveyModel.errors,
    process: SurveyModel.process,
    validation: SurveyModel.validation
  };
  const SurveyModelClient = ModelsClient.Survey(Lib, {});
  Lib.Survey = {
    data: { ...Lib.Survey.data, ...SurveyModelClient.data },
    errors: { ...Lib.Survey.errors, ...SurveyModelClient.errors },
    process: { ...Lib.Survey.process, ...SurveyModelClient.process },
    validation: { ...Lib.Survey.validation, ...SurveyModelClient.validation }
  };


  /////////////////////////// RETURN LIB START /////////////////////////////////

  // Return fully loaded Lib for testing
  return Lib;

};///////////////////////////// Module Exports END /////////////////////////////
