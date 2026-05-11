// Survey validation boundaries + enums + defaults
// Overrideable via environment config via loader

'use strict';


module.exports = {

  // Survey title constraints
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 200,

  // Survey description constraints
  DESCRIPTION_MAX_LENGTH: 2000,

  // Survey status values
  STATUS_VALUES: ['draft', 'published', 'closed', 'archived'],
  DEFAULT_STATUS: 'draft',

  // Question constraints
  QUESTION_TEXT_MIN_LENGTH: 1,
  QUESTION_TEXT_MAX_LENGTH: 1000,
  QUESTIONS_MIN_COUNT: 1,
  QUESTIONS_MAX_COUNT: 100,

  // Question types
  QUESTION_TYPES: ['text', 'number', 'single_choice', 'multi_choice', 'scale', 'date'],
  CHOICE_QUESTION_TYPES: ['single_choice', 'multi_choice'],

  // Option constraints (for choice-type questions)
  OPTION_LABEL_MIN_LENGTH: 1,
  OPTION_LABEL_MAX_LENGTH: 500,
  OPTIONS_MIN_COUNT: 2,
  OPTIONS_MAX_COUNT: 50,

  // Scale constraints (for scale-type questions)
  SCALE_MIN_VALUE: 0,
  SCALE_MAX_VALUE: 100,

  // Number constraints (for number-type questions)
  NUMBER_MIN_BOUND: -999999999,
  NUMBER_MAX_BOUND: 999999999,

  // Conditional rule operators
  RULE_OPERATORS: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'],

  // Conditional rule actions
  RULE_ACTIONS: ['show', 'hide', 'require', 'skip_to'],

  // Order constraints
  ORDER_MIN: 0,
  ORDER_MAX: 9999

};
