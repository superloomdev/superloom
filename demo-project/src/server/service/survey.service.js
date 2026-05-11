// Info: Survey Core Module - Business logic and orchestration for Survey entity
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};

// Runtime config (injected; resolved app config)
let Config = {};


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + Config for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - resolved app configuration
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  Config = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return SurveyCore;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyCore = {

  /********************************************************************
  Create a new Survey with nested questions, options, and rules

  @param {Object} data - Validated create input data object
  @param {String} data.title - Survey title
  @param {String|null} data.description - Survey description
  @param {Object[]} data.questions - Array of question data objects
  @param {Object[]} data.rules - Array of rule data objects

  @return {Object} result - { success: true, data: survey } or { success: false, error }
  *********************************************************************/
  createSurvey: async function (data) {

    // Build survey data using base model (accessed via .base on extended model)
    const survey_data = Lib.Survey.base.data.create(
      data.title,
      data.description,
      data.questions
    );


    // Attach rules
    survey_data.rules = data.rules || [];


    // Add server-only fields (extended model includes both base + server methods)
    const server_data = Lib.Survey.addServerFields(
      survey_data,
      data.created_by || null,
      data.organization_id || null
    );


    // Persist to database (via DB helper)
    // var record = await Lib.DB.addRecord('surveys', server_data);


    // Placeholder: simulate persisted record with an ID
    const record = { ...server_data, id: 'srv_' + Date.now().toString(36) };


    // Return
    return { success: true, data: record };

  },


  /********************************************************************
  Get Survey by ID

  @param {String} id - Survey ID

  @return {Object} result - { success: true, data: survey } or { success: false, error }
  *********************************************************************/
  getSurveyById: async function (id) {

    // Fetch from database (via DB helper)
    // var record = await Lib.DB.getRecord('surveys', { id: id });


    // Placeholder: simulate not-found
    const record = null;

    if (!record) {
      return { success: false, error: Lib.Survey.errors.NOT_FOUND };
    }


    // Return
    return { success: true, data: record };

  },


  /********************************************************************
  Update Survey metadata (title, description, status)

  @param {Object} data - Validated update input data object
  @param {String} data.id - Survey ID
  @param {String|undefined} data.title - Updated title
  @param {String|undefined} data.description - Updated description
  @param {String|undefined} data.status - Updated status

  @return {Object} result - { success: true, data: survey } or { success: false, error }
  *********************************************************************/
  updateSurvey: async function (data) {

    // Build update shape using base model (accessed via .base on extended model)
    const update_data = Lib.Survey.base.data.createUpdate({
      title: data.title,
      description: data.description,
      status: data.status
    });


    // Add server audit fields (extended model includes both base + server methods)
    const server_update = Lib.Survey.addServerUpdateFields(
      update_data,
      data.updated_by || null
    );


    // Persist update to database (via DB helper)
    // var record = await Lib.DB.updateRecord('surveys', { id: data.id }, server_update);


    // Placeholder: simulate updated record
    const record = { id: data.id, ...server_update };


    // Return
    return { success: true, data: record };

  }

};///////////////////////////Public Functions END///////////////////////////////
