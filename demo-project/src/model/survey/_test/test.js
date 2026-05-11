// Info: Test Cases for Survey base model module
// Uses simulating loader pattern for proper dependency injection
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load models via simulating loader (proper DI pattern)
const loadLib = require('../../_test/loader');
const Lib = loadLib();
const Survey = Lib.Survey;

// Load config directly (entity modules do not export their config)
const SurveyConfig = require('../survey.config');

// Load mock data
const validSurvey = require('./mock-data/valid-survey.json');



describe('Survey Model - Config', function () {

  it('should have valid question types', function () {

    assert.ok(Array.isArray(SurveyConfig.QUESTION_TYPES));
    assert.ok(SurveyConfig.QUESTION_TYPES.includes('text'));
    assert.ok(SurveyConfig.QUESTION_TYPES.includes('single_choice'));
    assert.ok(SurveyConfig.QUESTION_TYPES.includes('scale'));

  });


  it('should have valid rule operators and actions', function () {

    assert.ok(SurveyConfig.RULE_OPERATORS.includes('equals'));
    assert.ok(SurveyConfig.RULE_ACTIONS.includes('show'));
    assert.ok(SurveyConfig.RULE_ACTIONS.includes('skip_to'));

  });

});



describe('Survey Model - Data', function () {

  it('should create a survey with defaults via data.create', function () {

    const survey = Survey.data.create(
      ' My Survey ',
      ' Description ',
      []
    );

    assert.strictEqual(survey.title, 'My Survey');
    assert.strictEqual(survey.description, 'Description');
    assert.strictEqual(survey.status, 'draft');
    assert.ok(Array.isArray(survey.questions));
    assert.ok(survey.created_at);

  });


  it('should create a question via data.createQuestion', function () {

    const question = Survey.data.createQuestion(
      'q1', 'What is your name?', 'text', 1, true, [], null
    );

    assert.strictEqual(question.question_id, 'q1');
    assert.strictEqual(question.text, 'What is your name?');
    assert.strictEqual(question.type, 'text');
    assert.strictEqual(question.is_required, true);

  });


  it('should create an option via data.createOption with value defaulting to label', function () {

    const option = Survey.data.createOption('o1', ' Yes ', 1, null);

    assert.strictEqual(option.option_id, 'o1');
    assert.strictEqual(option.label, 'Yes');
    assert.strictEqual(option.value, 'Yes');

  });


  it('should create a conditional rule via data.createRule', function () {

    const rule = Survey.data.createRule('q1', 'equals', 'yes', 'show', 'q3');

    assert.strictEqual(rule.source_question_id, 'q1');
    assert.strictEqual(rule.operator, 'equals');
    assert.strictEqual(rule.action, 'show');
    assert.strictEqual(rule.target_question_id, 'q3');

  });


  it('should create update shape with only provided fields via data.createUpdate', function () {

    const update = Survey.data.createUpdate({
      title: 'New Title',
      status: 'published'
    });

    assert.strictEqual(update.title, 'New Title');
    assert.strictEqual(update.description, undefined);
    assert.strictEqual(update.status, 'published');
    assert.strictEqual(update.questions, undefined);
    assert.ok(update.updated_at);

  });

});



describe('Survey Model - Validation (Happy Path)', function () {

  it('should pass validation for a valid survey from mock data', function () {

    const result = Survey.validation.validateCreate(
      validSurvey.title,
      validSurvey.description,
      validSurvey.questions,
      validSurvey.rules
    );

    assert.strictEqual(result, false);

  });


  it('should pass validation for a minimal valid survey', function () {

    const result = Survey.validation.validateCreate(
      'Short Survey',
      null,
      [{ question_id: 'q1', text: 'Name?', type: 'text', order: 1, options: [] }],
      []
    );

    assert.strictEqual(result, false);

  });

});



describe('Survey Model - Validation (Survey-Level Errors)', function () {

  it('should fail when title is missing', function () {

    const result = Survey.validation.validateCreate(
      null, null,
      [{ question_id: 'q1', text: 'Q?', type: 'text', options: [] }],
      []
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'SURVEY_TITLE_REQUIRED'; }));

  });


  it('should fail when questions array is empty', function () {

    const result = Survey.validation.validateCreate(
      'Title', null, [], []
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'SURVEY_QUESTIONS_REQUIRED'; }));

  });

});



describe('Survey Model - Validation (Question-Level Errors)', function () {

  it('should fail when question type is invalid', function () {

    const result = Survey.validation.validateCreate(
      'Title', null,
      [{ question_id: 'q1', text: 'Q?', type: 'invalid_type', options: [] }],
      []
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'QUESTION_TYPE_INVALID'; }));

  });


  it('should fail when choice question has no options', function () {

    const result = Survey.validation.validateCreate(
      'Title', null,
      [{ question_id: 'q1', text: 'Pick one', type: 'single_choice', options: [] }],
      []
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'OPTIONS_REQUIRED_FOR_CHOICE'; }));

  });


  it('should fail when non-choice question has options', function () {

    const result = Survey.validation.validateCreate(
      'Title', null,
      [{
        question_id: 'q1', text: 'Name?', type: 'text',
        options: [{ label: 'A' }, { label: 'B' }]
      }],
      []
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'OPTIONS_NOT_ALLOWED'; }));

  });


  it('should fail when scale min >= max', function () {

    const result = Survey.validation.validateCreate(
      'Title', null,
      [{
        question_id: 'q1', text: 'Rate', type: 'scale', options: [],
        constraints: { min: 10, max: 5 }
      }],
      []
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'SCALE_RANGE_INVALID'; }));

  });

});



describe('Survey Model - Validation (Rule Cross-Reference Errors)', function () {

  it('should fail when rule references non-existent source question', function () {

    const result = Survey.validation.validateCreate(
      'Title', null,
      [{ question_id: 'q1', text: 'Q?', type: 'text', options: [] }],
      [{ source_question_id: 'q99', operator: 'equals', value: 'x', action: 'show', target_question_id: 'q1' }]
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'RULE_SOURCE_QUESTION_INVALID'; }));

  });


  it('should fail when rule is a self-reference', function () {

    const result = Survey.validation.validateCreate(
      'Title', null,
      [{ question_id: 'q1', text: 'Q?', type: 'text', options: [] }],
      [{ source_question_id: 'q1', operator: 'equals', value: 'x', action: 'show', target_question_id: 'q1' }]
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'RULE_SELF_REFERENCE'; }));

  });


  it('should fail when rule operator is invalid', function () {

    const questions = [
      { question_id: 'q1', text: 'Q1', type: 'text', options: [] },
      { question_id: 'q2', text: 'Q2', type: 'text', options: [] }
    ];

    const result = Survey.validation.validateCreate(
      'Title', null, questions,
      [{ source_question_id: 'q1', operator: 'bad_op', value: 'x', action: 'show', target_question_id: 'q2' }]
    );

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'RULE_OPERATOR_INVALID'; }));

  });

});



describe('Survey Model - Validation (Update)', function () {

  it('should pass update validation with valid partial data', function () {

    const result = Survey.validation.validateUpdate('New Title', undefined, undefined);
    assert.strictEqual(result, false);

  });


  it('should fail update validation with invalid status', function () {

    const result = Survey.validation.validateUpdate(undefined, undefined, 'bad_status');

    assert.ok(Array.isArray(result));
    assert.ok(result.some(function (e) { return e.code === 'SURVEY_STATUS_INVALID'; }));

  });

});



describe('Survey Model - DTO Transformations', function () {

  it('should build complete survey data with all provided keys via data.create', function () {

    const data = Survey.data.create(
      'My Survey', 'Description',
      [{ question_id: 'q1' }]
    );
    data.id = 'srv_123'; // Set id manually for testing
    data.rules = [{ source_question_id: 'q1' }];

    assert.strictEqual(data.id, 'srv_123');
    assert.strictEqual(data.title, 'My Survey');
    assert.strictEqual(data.description, 'Description');
    assert.strictEqual(data.questions.length, 1);
    assert.strictEqual(data.rules.length, 1);
    assert.ok(data.created_at);

  });


  it('should not add keys that are undefined (absent keys not set)', function () {

    const data = Survey.data.create('Title', undefined, undefined);
    data.id = 'srv_123';
    data.status = 'published';

    assert.strictEqual(data.id, 'srv_123');
    assert.strictEqual(data.title, 'Title');
    assert.strictEqual(data.status, 'published');
    assert.strictEqual(data.description, null);
    assert.strictEqual(data.questions.length, 0);

  });


  it('should build question data with explicit parameters via data.createQuestion', function () {

    const data = Survey.data.createQuestion(
      'q1', 'Favorite color?', 'single_choice', 1, true,
      [{ option_id: 'o1', label: 'Red' }],
      null
    );

    assert.strictEqual(data.question_id, 'q1');
    assert.strictEqual(data.type, 'single_choice');
    assert.strictEqual(data.is_required, true);

  });


  it('should build public data from full object, stripping server-only fields via data.toPublic', function () {

    const full_data = Survey.data.create('Title', null, []);
    full_data.id = 'srv_123';
    full_data.created_at = 1234567890;
    full_data.updated_at = 9999999999;

    const public_data = Survey.data.toPublic(full_data);

    assert.strictEqual(public_data.id, 'srv_123');
    assert.strictEqual(public_data.status, 'draft');
    assert.strictEqual(public_data.created_at, 1234567890);
    assert.strictEqual('updated_at' in public_data, false);

  });

});



// Deep Data tests removed - createDeep replaces the old deep data builder pattern

