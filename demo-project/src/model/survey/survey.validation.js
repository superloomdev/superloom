// Info: Pure validation functions for Survey entity
// Handles nested validation: survey -> questions -> options + cross-reference rules
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;

// Error catalog (injected; independent from config)
let ERRORS;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG + ERRORS for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @param {Object} errors - error catalog for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config, errors) {

  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config, errors) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config, errors);

  // Return Public Functions of this module
  return SurveyValidation;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const SurveyValidation = {

  /********************************************************************
  Validate data for creating a new Survey (with nested questions, options, rules)

  @param {String} title - Survey title
  @param {String|null} description - Survey description
  @param {Object[]} questions - Array of question data
  @param {Object[]} rules - Array of conditional rule data

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateCreate: function (title, description, questions, rules) {

    let errors = [];

    // --- Survey-level validation ---

    // Title (required) — using Utils.validateString() for generic string check
    if (!title || typeof title !== 'string') {
      errors.push(ERRORS.TITLE_REQUIRED);
    }
    else if (!Lib.Utils.validateString(title.trim(), CONFIG.TITLE_MIN_LENGTH, CONFIG.TITLE_MAX_LENGTH)) {
      errors.push(ERRORS.TITLE_INVALID);
    }

    // Description (optional, but bounded) — using Utils.validateString()
    if (description !== undefined && description !== null) {
      if (typeof description === 'string' && !Lib.Utils.validateString(description.trim(), null, CONFIG.DESCRIPTION_MAX_LENGTH)) {
        errors.push(ERRORS.DESCRIPTION_TOO_LONG);
      }
    }

    // --- Questions validation ---
    if (!Array.isArray(questions) || questions.length < CONFIG.QUESTIONS_MIN_COUNT) {
      errors.push(ERRORS.QUESTIONS_REQUIRED);
    }
    else if (questions.length > CONFIG.QUESTIONS_MAX_COUNT) {
      errors.push(ERRORS.QUESTIONS_EXCEEDED);
    }
    else {
      // Validate each question
      const question_ids = [];
      for (let i = 0; i < questions.length; i++) {
        const q_errors = SurveyValidation.validateQuestion(questions[i]);
        if (q_errors) {
          errors = errors.concat(q_errors);
        }
        if (questions[i].question_id) {
          question_ids.push(questions[i].question_id);
        }
      }

      // --- Rules validation (cross-references between questions) ---
      if (Array.isArray(rules) && rules.length > 0) {
        for (let j = 0; j < rules.length; j++) {
          const r_errors = SurveyValidation.validateRule(rules[j], question_ids);
          if (r_errors) {
            errors = errors.concat(r_errors);
          }
        }
      }
    }

    return errors.length > 0 ? errors : false;

  },


  /********************************************************************
  Validate a single Question object

  @param {Object} question - Question data
  @param {String} question.question_id - Question identifier
  @param {String} question.text - Question text
  @param {String} question.type - Question type
  @param {Number} question.order - Display order
  @param {Object[]} [question.options] - Options (for choice types)
  @param {Object} [question.constraints] - Type-specific constraints

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateQuestion: function (question) {

    let errors = [];

    // Text (required)
    if (!question.text || typeof question.text !== 'string') {
      errors.push(ERRORS.QUESTION_TEXT_REQUIRED);
    }
    else if (
      question.text.trim().length < CONFIG.QUESTION_TEXT_MIN_LENGTH ||
      question.text.trim().length > CONFIG.QUESTION_TEXT_MAX_LENGTH
    ) {
      errors.push(ERRORS.QUESTION_TEXT_INVALID);
    }

    // Type (required, must be valid)
    if (!question.type || !CONFIG.QUESTION_TYPES.includes(question.type)) {
      errors.push(ERRORS.QUESTION_TYPE_INVALID);
      return errors; // Cannot validate further without a valid type
    }

    // Order (optional, but must be valid if provided)
    if (question.order !== undefined && question.order !== null) {
      if (typeof question.order !== 'number' || question.order < CONFIG.ORDER_MIN || question.order > CONFIG.ORDER_MAX) {
        errors.push(ERRORS.QUESTION_ORDER_INVALID);
      }
    }

    // Type-dependent validation: choice questions MUST have options
    const is_choice_type = CONFIG.CHOICE_QUESTION_TYPES.includes(question.type);

    if (is_choice_type) {
      if (!Array.isArray(question.options) || question.options.length < CONFIG.OPTIONS_MIN_COUNT) {
        errors.push(ERRORS.OPTIONS_REQUIRED_FOR_CHOICE);
      }
      else if (question.options.length > CONFIG.OPTIONS_MAX_COUNT) {
        errors.push(ERRORS.OPTIONS_EXCEEDED);
      }
      else {
        // Validate each option
        for (let i = 0; i < question.options.length; i++) {
          const o_errors = SurveyValidation.validateOption(question.options[i]);
          if (o_errors) {
            errors = errors.concat(o_errors);
          }
        }
      }
    }
    else {
      // Non-choice questions must NOT have options
      if (Array.isArray(question.options) && question.options.length > 0) {
        errors.push(ERRORS.OPTIONS_NOT_ALLOWED);
      }
    }

    // Type-dependent validation: scale constraints
    if (question.type === 'scale' && question.constraints) {
      const c = question.constraints;
      if (c.min !== undefined && (typeof c.min !== 'number' || c.min < CONFIG.SCALE_MIN_VALUE)) {
        errors.push(ERRORS.SCALE_MIN_INVALID);
      }
      if (c.max !== undefined && (typeof c.max !== 'number' || c.max > CONFIG.SCALE_MAX_VALUE)) {
        errors.push(ERRORS.SCALE_MAX_INVALID);
      }
      if (c.min !== undefined && c.max !== undefined && c.min >= c.max) {
        errors.push(ERRORS.SCALE_RANGE_INVALID);
      }
    }

    return errors.length > 0 ? errors : false;

  },


  /********************************************************************
  Validate a single Option object

  @param {Object} option - Option data
  @param {String} option.label - Option display label

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateOption: function (option) {

    const errors = [];

    if (!option.label || typeof option.label !== 'string') {
      errors.push(ERRORS.OPTION_LABEL_REQUIRED);
    }
    else if (
      option.label.trim().length < CONFIG.OPTION_LABEL_MIN_LENGTH ||
      option.label.trim().length > CONFIG.OPTION_LABEL_MAX_LENGTH
    ) {
      errors.push(ERRORS.OPTION_LABEL_INVALID);
    }

    return errors.length > 0 ? errors : false;

  },


  /********************************************************************
  Validate a Conditional Rule (cross-references between questions)

  @param {Object} rule - Rule data
  @param {String} rule.source_question_id - Question that triggers this rule
  @param {String} rule.operator - Comparison operator
  @param {*} rule.value - Comparison value
  @param {String} rule.action - Action to take when rule matches
  @param {String} rule.target_question_id - Question affected by this rule
  @param {String[]} valid_question_ids - All valid question IDs in the survey

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateRule: function (rule, valid_question_ids) {

    const errors = [];

    // Source question must exist in survey
    if (!rule.source_question_id || !valid_question_ids.includes(rule.source_question_id)) {
      errors.push(ERRORS.RULE_SOURCE_QUESTION_INVALID);
    }

    // Target question must exist in survey
    if (!rule.target_question_id || !valid_question_ids.includes(rule.target_question_id)) {
      errors.push(ERRORS.RULE_TARGET_QUESTION_INVALID);
    }

    // Self-reference check (a rule cannot target its own source)
    if (
      rule.source_question_id &&
      rule.target_question_id &&
      rule.source_question_id === rule.target_question_id
    ) {
      errors.push(ERRORS.RULE_SELF_REFERENCE);
    }

    // Operator must be valid
    if (!rule.operator || !CONFIG.RULE_OPERATORS.includes(rule.operator)) {
      errors.push(ERRORS.RULE_OPERATOR_INVALID);
    }

    // Action must be valid
    if (!rule.action || !CONFIG.RULE_ACTIONS.includes(rule.action)) {
      errors.push(ERRORS.RULE_ACTION_INVALID);
    }

    // Value is required
    if (rule.value === undefined || rule.value === null) {
      errors.push(ERRORS.RULE_VALUE_REQUIRED);
    }

    return errors.length > 0 ? errors : false;

  },


  /********************************************************************
  Validate data for updating a Survey

  @param {String|undefined} title - Updated title
  @param {String|undefined} description - Updated description
  @param {String|undefined} status - Updated status

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateUpdate: function (title, description, status) {

    const errors = [];

    // Title (if provided)
    if (title !== undefined && title !== null) {
      if (typeof title !== 'string') {
        errors.push(ERRORS.TITLE_INVALID);
      }
      else if (
        title.trim().length < CONFIG.TITLE_MIN_LENGTH ||
        title.trim().length > CONFIG.TITLE_MAX_LENGTH
      ) {
        errors.push(ERRORS.TITLE_INVALID);
      }
    }

    // Description (if provided)
    if (description !== undefined && description !== null) {
      if (typeof description === 'string' && description.trim().length > CONFIG.DESCRIPTION_MAX_LENGTH) {
        errors.push(ERRORS.DESCRIPTION_TOO_LONG);
      }
    }

    // Status (if provided)
    if (status !== undefined && status !== null) {
      if (!CONFIG.STATUS_VALUES.includes(status)) {
        errors.push(ERRORS.STATUS_INVALID);
      }
    }

    return errors.length > 0 ? errors : false;

  }

};///////////////////////////Public Functions END///////////////////////////////
