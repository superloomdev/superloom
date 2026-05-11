// Survey entity data + DTO utilities
// Centralized construction and output shaping
// Standard pattern: entity + public data transformers
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return SurveyData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyData = { // Public functions accessible by other modules

  /********************************************************************
  Create a new Survey data object with defaults and sanitization
  This is the canonical shape - used for creation and internal representation

  @param {String} title - Survey title
  @param {String|null} description - Survey description
  @param {Object[]} questions - Array of question data objects

  @return {Object} - Canonical survey data with defaults applied
  *********************************************************************/
  create: function (title, description, questions) {

    // Return
    return {
      title: title ? title.trim() : null,
      description: description ? description.trim() : null,
      status: CONFIG.DEFAULT_STATUS,
      questions: questions || [],
      rules: [],
      created_at: Date.now(),
      updated_at: Date.now()
    };

  },


  /********************************************************************
  Create a Question data object with defaults

  @param {String} question_id - Unique question identifier
  @param {String} text - Question text
  @param {String} type - Question type (text|number|single_choice|multi_choice|scale|date)
  @param {Number} order - Display order
  @param {Boolean} is_required - Whether answer is required
  @param {Object[]} options - Array of option entities (for choice types)
  @param {Object|null} constraints - Type-specific constraints

  @return {Object} - Canonical question data
  *********************************************************************/
  createQuestion: function (question_id, text, type, order, is_required, options, constraints) {

    // Return
    return {
      question_id: question_id,
      text: text ? text.trim() : null,
      type: type,
      order: order || 0,
      is_required: is_required === true,
      options: options || [],
      constraints: constraints || null
    };

  },


  /********************************************************************
  Create an Option data object with defaults

  @param {String} option_id - Unique option identifier
  @param {String} label - Option display label
  @param {Number} order - Display order
  @param {*} value - Option value (defaults to label)

  @return {Object} - Canonical option data
  *********************************************************************/
  createOption: function (option_id, label, order, value) {

    // Initialise
    const trimmed_label = label ? label.trim() : null;


    // Return
    return {
      option_id: option_id,
      label: trimmed_label,
      order: order || 0,
      value: (value !== undefined && value !== null) ? value : trimmed_label
    };

  },


  /********************************************************************
  Create a Conditional Rule data object

  @param {String} source_question_id - Question that triggers the rule
  @param {String} operator - Comparison operator
  @param {*} value - Value to compare against
  @param {String} action - Rule action (show|hide|require|skip_to)
  @param {String} target_question_id - Question affected by the action

  @return {Object} - Canonical rule data
  *********************************************************************/
  createRule: function (source_question_id, operator, value, action, target_question_id) {

    // Return
    return {
      source_question_id: source_question_id,
      operator: operator,
      value: value,
      action: action,
      target_question_id: target_question_id
    };

  },


  /********************************************************************
  Create a partial update data object (only changed fields + updated_at)

  @param {Object} data - Fields to update
  @param {String} [data.title] - Updated title
  @param {String} [data.description] - Updated description
  @param {String} [data.status] - Updated status
  @param {Object[]} [data.questions] - Updated questions
  @param {Object[]} [data.rules] - Updated rules

  @return {Object} - Update data with only provided fields + updated_at
  *********************************************************************/
  createUpdate: function (data) {

    // Initialise
    const update = {};

    // Set fields if provided
    if (data.title !== undefined && data.title !== null) {
      update.title = data.title.trim();
    }

    if (data.description !== undefined && data.description !== null) {
      update.description = data.description.trim();
    }

    if (data.status !== undefined && data.status !== null) {
      update.status = data.status;
    }

    if (data.questions !== undefined) {
      update.questions = data.questions;
    }

    if (data.rules !== undefined) {
      update.rules = data.rules;
    }

    update.updated_at = Date.now();


    // Return
    return update;

  },


  /********************************************************************
  Create deep survey data with nested structures

  @param {Object} survey_data - Core survey data
  @param {Object[]} [responses] - Associated responses
  @param {Object} [statistics] - Computed statistics
  @param {Object} [metadata] - System metadata

  @return {Object} - Survey deep data with nested structures
  *********************************************************************/
  createDeep: function (survey_data, responses, statistics, metadata) {

    // Return
    return {
      survey_data: survey_data,
      responses: responses || [],
      statistics: statistics || {},
      metadata: metadata || {}
    };

  },


  /********************************************************************
  Transform to public output (strips server-only fields)

  @param {Object} survey_data - Full internal survey data

  @return {Object} - Public-safe survey data
  *********************************************************************/
  toPublic: function (survey_data) {

    // Return
    return {
      id: survey_data.id,
      title: survey_data.title,
      description: survey_data.description,
      status: survey_data.status,
      questions: survey_data.questions ? survey_data.questions.map(SurveyData.question.toPublic) : [],
      rules: survey_data.rules,
      created_at: survey_data.created_at
    };

  },


  /********************************************************************
  Transform to summary for list views

  @param {Object} survey_data - Full internal survey data

  @return {Object} - Minimal summary for lists
  *********************************************************************/
  toSummary: function (survey_data) {

    // Return
    return {
      id: survey_data.id,
      title: survey_data.title,
      status: survey_data.status,
      question_count: survey_data.questions ? survey_data.questions.length : 0,
      created_at: survey_data.created_at
    };

  },


  /********************************************************************
  Transform external input to internal canonical shape

  @param {Object} external_data - Raw external data

  @return {Object} - Canonical internal shape
  *********************************************************************/
  toInternal: function (external_data) {

    // Return
    return SurveyData.create(
      external_data.title,
      external_data.description,
      external_data.questions
    );

  },


  // Sub-entity transforms
  question: {

    /********************************************************************
    Transform question to public output

    @param {Object} question_data - Full question data

    @return {Object} - Public-safe question data
    *********************************************************************/
    toPublic: function (question_data) {

      // Return
      return {
        question_id: question_data.question_id,
        text: question_data.text,
        type: question_data.type,
        order: question_data.order,
        is_required: question_data.is_required,
        options: question_data.options ? question_data.options.map(SurveyData.option.toPublic) : undefined,
        constraints: question_data.constraints
      };

    },


    /********************************************************************
    Transform question to summary

    @param {Object} question_data - Full question data

    @return {Object} - Question summary
    *********************************************************************/
    toSummary: function (question_data) {

      // Return
      return {
        question_id: question_data.question_id,
        text: question_data.text,
        type: question_data.type,
        order: question_data.order
      };

    }

  },


  option: {

    /********************************************************************
    Transform option to public output

    @param {Object} option_data - Full option data

    @return {Object} - Public-safe option data
    *********************************************************************/
    toPublic: function (option_data) {

      // Return
      return {
        option_id: option_data.option_id,
        label: option_data.label,
        order: option_data.order,
        value: option_data.value
      };

    }

  }

};////////////////////////////Public Functions END//////////////////////////////

