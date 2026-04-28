// Info: Domain error catalog for Survey entity
// Error codes + default messages + optional HTTP status
'use strict';


module.exports = {

  // --- Survey-level errors ---

  TITLE_REQUIRED: {
    code: 'SURVEY_TITLE_REQUIRED',
    message: 'Survey title is required',
    status: 400
  },

  TITLE_INVALID: {
    code: 'SURVEY_TITLE_INVALID',
    message: 'Survey title does not meet length requirements',
    status: 400
  },

  DESCRIPTION_TOO_LONG: {
    code: 'SURVEY_DESCRIPTION_TOO_LONG',
    message: 'Survey description exceeds maximum length',
    status: 400
  },

  STATUS_INVALID: {
    code: 'SURVEY_STATUS_INVALID',
    message: 'Survey status value is not recognized',
    status: 400
  },

  NOT_FOUND: {
    code: 'SURVEY_NOT_FOUND',
    message: 'Survey not found',
    status: 404
  },

  ID_REQUIRED: {
    code: 'SURVEY_ID_REQUIRED',
    message: 'Survey ID is required',
    status: 400
  },


  // --- Question-level errors ---

  QUESTIONS_REQUIRED: {
    code: 'SURVEY_QUESTIONS_REQUIRED',
    message: 'Survey must have at least one question',
    status: 400
  },

  QUESTIONS_EXCEEDED: {
    code: 'SURVEY_QUESTIONS_EXCEEDED',
    message: 'Survey has exceeded maximum number of questions',
    status: 400
  },

  QUESTION_TEXT_REQUIRED: {
    code: 'QUESTION_TEXT_REQUIRED',
    message: 'Question text is required',
    status: 400
  },

  QUESTION_TEXT_INVALID: {
    code: 'QUESTION_TEXT_INVALID',
    message: 'Question text does not meet length requirements',
    status: 400
  },

  QUESTION_TYPE_INVALID: {
    code: 'QUESTION_TYPE_INVALID',
    message: 'Question type is not recognized',
    status: 400
  },

  QUESTION_ORDER_INVALID: {
    code: 'QUESTION_ORDER_INVALID',
    message: 'Question order value is invalid',
    status: 400
  },


  // --- Option-level errors ---

  OPTIONS_REQUIRED_FOR_CHOICE: {
    code: 'OPTIONS_REQUIRED_FOR_CHOICE',
    message: 'Choice-type questions must have at least two options',
    status: 400
  },

  OPTIONS_EXCEEDED: {
    code: 'OPTIONS_EXCEEDED',
    message: 'Question has exceeded maximum number of options',
    status: 400
  },

  OPTIONS_NOT_ALLOWED: {
    code: 'OPTIONS_NOT_ALLOWED',
    message: 'Options are only allowed for choice-type questions',
    status: 400
  },

  OPTION_LABEL_REQUIRED: {
    code: 'OPTION_LABEL_REQUIRED',
    message: 'Option label is required',
    status: 400
  },

  OPTION_LABEL_INVALID: {
    code: 'OPTION_LABEL_INVALID',
    message: 'Option label does not meet length requirements',
    status: 400
  },


  // --- Scale/Number constraints errors ---

  SCALE_MIN_INVALID: {
    code: 'SCALE_MIN_INVALID',
    message: 'Scale minimum value is out of allowed range',
    status: 400
  },

  SCALE_MAX_INVALID: {
    code: 'SCALE_MAX_INVALID',
    message: 'Scale maximum value is out of allowed range',
    status: 400
  },

  SCALE_RANGE_INVALID: {
    code: 'SCALE_RANGE_INVALID',
    message: 'Scale minimum must be less than maximum',
    status: 400
  },


  // --- Conditional rule errors ---

  RULE_SOURCE_QUESTION_INVALID: {
    code: 'RULE_SOURCE_QUESTION_INVALID',
    message: 'Rule references a question that does not exist in this survey',
    status: 400
  },

  RULE_TARGET_QUESTION_INVALID: {
    code: 'RULE_TARGET_QUESTION_INVALID',
    message: 'Rule targets a question that does not exist in this survey',
    status: 400
  },

  RULE_OPERATOR_INVALID: {
    code: 'RULE_OPERATOR_INVALID',
    message: 'Rule operator is not recognized',
    status: 400
  },

  RULE_ACTION_INVALID: {
    code: 'RULE_ACTION_INVALID',
    message: 'Rule action is not recognized',
    status: 400
  },

  RULE_SELF_REFERENCE: {
    code: 'RULE_SELF_REFERENCE',
    message: 'A rule cannot reference its own question as the target',
    status: 400
  },

  RULE_VALUE_REQUIRED: {
    code: 'RULE_VALUE_REQUIRED',
    message: 'Rule comparison value is required',
    status: 400
  }

};
