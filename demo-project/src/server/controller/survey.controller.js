// Info: Survey Controller Module - Thin adapter between interfaces and core
// Handles validation via Model, Data creation with explicit params, delegates to Core
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @return {void}
  *********************************************************************/
const loader = function (shared_libs) {

  Lib = shared_libs;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs) {

  // Run module-scope loader (local DI)
  loader(shared_libs);

  // Return Public Functions of this module
  return SurveyController;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyController = {

  /********************************************************************
  Create a new Survey with questions, options, and rules

  @param {Object} request - Standardized request object
  @param {Object} request.body - Request body with survey data

  @return {Object} - Standardized response object
  *********************************************************************/
  create: async function (request) {

    // Step 1: Extract input
    const body = request.body;
    const title = body.title;
    const description = body.description;
    const questions = body.questions || [];
    const rules = body.rules || [];


    // Step 2: Validate using Model (shared validation - same for Express and Lambda)
    const validation_errors = Lib.Survey.base.validation.validateCreate(
      title, description, questions, rules
    );

    if (validation_errors) {
      return Lib.Functions.errorResponse(validation_errors[0], validation_errors[0].status);
    }


    // Step 3: Build Data using Model (explicit parameters)
    const question_data_list = questions.map(function (q) {

      const option_data_list = (q.options || []).map(function (o) {
        return Lib.Survey.base.data.createOption(
          o.option_id, o.label, o.order, o.value
        );
      });

      return Lib.Survey.base.data.createQuestion(
        q.question_id, q.text, q.type, q.order, q.is_required, option_data_list, q.constraints
      );

    });

    const rule_data_list = rules.map(function (r) {
      return Lib.Survey.base.data.createRule(
        r.source_question_id, r.operator, r.value, r.action, r.target_question_id
      );
    });

    const survey_data = Lib.Survey.base.data.create(
      title, description, question_data_list
    );

    survey_data.rules = rule_data_list;


    // Step 4: Delegate to Service
    const result = await Lib.Survey.service.createSurvey(survey_data);


    // Step 5: Map Core result to controller response
    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status);
    }


    // Return
    return Lib.Functions.successResponse(
      Lib.Survey.base.data.toPublic(result.data),
      201
    );

  },


  /********************************************************************
  Get Survey by ID

  @param {Object} request - Standardized request object
  @param {Object} request.params - URL parameters
  @param {String} request.params.id - Survey ID

  @return {Object} - Standardized response object
  *********************************************************************/
  getById: async function (request) {

    // Step 1: Extract ID
    const id = request.params.id;


    // Step 2: Validate required param
    if (!id) {
      return Lib.Functions.errorResponse(Lib.Survey.base.errors.ID_REQUIRED, 400);
    }


    // Step 3: Delegate to Service
    const result = await Lib.Survey.service.getSurveyById(id);


    // Step 4: Map Core result
    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status);
    }


    // Return
    return Lib.Functions.successResponse(
      Lib.Survey.base.data.toPublic(result.data)
    );

  },


  /********************************************************************
  Update Survey metadata

  @param {Object} request - Standardized request object

  @return {Object} - Standardized response object
  *********************************************************************/
  update: async function (request) {

    // Step 1: Extract input
    const id = request.params.id;
    const title = request.body.title;
    const description = request.body.description;
    const status = request.body.status;


    // Step 2: Validate required param
    if (!id) {
      return Lib.Functions.errorResponse(Lib.Survey.base.errors.ID_REQUIRED, 400);
    }


    // Step 3: Validate using Model
    const validation_errors = Lib.Survey.base.validation.validateUpdate(
      title, description, status
    );

    if (validation_errors) {
      return Lib.Functions.errorResponse(validation_errors[0], validation_errors[0].status);
    }


    // Step 4: Build update shape using Model
    const update_data = Lib.Survey.base.data.createUpdate({
      title: title,
      description: description,
      status: status
    });

    update_data.id = id;


    // Step 5: Delegate to Service
    const result = await Lib.Survey.service.updateSurvey(update_data);


    // Step 6: Map Core result
    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status);
    }


    // Return
    return Lib.Functions.successResponse(
      Lib.Survey.base.data.toPublic(result.data)
    );

  }

};///////////////////////////Public Functions END///////////////////////////////


//////////////////////////////Module Exports START//////////////////////////////
module.exports = function (shared_libs) {

  // Run module-scope loader (local DI)
  loader(shared_libs);

  // Return Public Functions of this module
  return SurveyController;

};/////////////////////////////Module Exports END///////////////////////////////
