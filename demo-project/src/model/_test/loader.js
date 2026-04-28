// Info: Simulating Loader for Model Testing
// Loads all models with proper Lib injection for cross-module dependencies
// Mimics the production loader pattern for isolated testing
// Modules return { data, errors, process, validation } objects
// Pattern: Lib.Entity = { data, errors, process, validation }
//
// PROGRESSIVE ENTITY BUILDUP (as loader runs):
//   Phase 1 (Model):   Lib.User = { data, errors, process, validation }
//   Phase 2 (Ctrl):    Lib.User.controller = { ... }
//   Phase 3 (Core):    Lib.User.core = { ... }  (future)
// Entities are namespaces that grow layer by layer.
// Only 'shared' module exports config; entity modules keep config internal.
'use strict';


////////////////////////////// Module Exports START //////////////////////////////
module.exports = function() {

  // Initialise shared libraries object
  const Lib = {};


  /////////////////////////// HELPER MODULES START /////////////////////////////

  // Load core helper modules
  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, {});

  // Load server helper modules
  // none


  /////////////////////////// ENTITY NAMESPACES START ////////////////////////////

  // Contact: depends on none, used by User, Survey
  // Adds: { data, errors, process, validation }
  Lib.Contact = require('../contact')(Lib, {});

  // User: depends on Contact, used by Survey
  // Adds: { data, errors, process, validation }
  Lib.User = require('../user')(Lib, {});

  // Survey: depends on Contact, User, used by none
  // Adds: { data, errors, process, validation }
  Lib.Survey = require('../survey')(Lib, {});

  // Shared: no dependencies
  // Adds: { data, errors, process, validation, config }  // exports config
  Lib.Shared = require('../shared')(Lib, {});


  /////////////////////////// RETURN LIB START /////////////////////////////////

  // Return fully loaded Lib for testing
  return Lib;

};///////////////////////////// Module Exports END /////////////////////////////
