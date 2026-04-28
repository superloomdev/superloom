// Info: Test Cases for Survey server model extension
// Uses simulating loader pattern for proper dependency injection
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load models via simulating loader (proper DI pattern)
const loadLib = require('../../_test/loader');
const Lib = loadLib();
const Survey = Lib.Survey;

// Load the Survey server model extension
const SurveyServerModel = Survey.data;

describe('Survey Server Model - Data', function () {

  it('should add server-only fields to a base survey entity', function () {

    const base_survey = {
      title: 'Test Survey',
      description: 'A test',
      status: 'draft',
      questions: [],
      rules: [],
      created_at: 1000,
      updated_at: 1000
    };

    const result = SurveyServerModel.addServerFields(base_survey, 'user_abc', 'org_123');

    // Base fields preserved
    assert.strictEqual(result.title, 'Test Survey');
    assert.strictEqual(result.status, 'draft');

    // Server-only fields added
    assert.strictEqual(result.created_by, 'user_abc');
    assert.strictEqual(result.organization_id, 'org_123');
    assert.strictEqual(result.response_count, 0);
    assert.strictEqual(result.is_published, false);
    assert.strictEqual(result.published_at, null);
    assert.strictEqual(result.closed_at, null);
    assert.strictEqual(result.internal_notes, null);
    assert.strictEqual(result.version, 1);

  });


  it('should default organization_id to null if not provided', function () {

    const base_survey = { title: 'Test', status: 'draft' };
    const result = SurveyServerModel.addServerFields(base_survey, 'user_abc', null);

    assert.strictEqual(result.organization_id, null);
    assert.strictEqual(result.created_by, 'user_abc');

  });


  it('should add server update fields with audit info', function () {

    const base_update = { title: 'Updated Title', status: 'active' };
    const result = SurveyServerModel.addServerUpdateFields(base_update, 'user_xyz');

    assert.strictEqual(result.title, 'Updated Title');
    assert.strictEqual(result.status, 'active');
    assert.strictEqual(result.updated_by, 'user_xyz');
    assert.strictEqual(result.version_increment, true);

  });


  it('should build internal server-only output object', function () {

    const result = SurveyServerModel.toInternal(
      'survey_123',
      { title: 'Test Survey', status: 'active' },
      42,      // response_count
      true,    // is_published
      '2024-01-15T10:00:00Z',  // published_at
      null,    // closed_at
      'org_456',
      'Internal admin notes here'
    );

    assert.strictEqual(result.id, 'survey_123');
    assert.strictEqual(result.title, 'Test Survey');
    assert.strictEqual(result.response_count, 42);
    assert.strictEqual(result.is_published, true);
    assert.strictEqual(result.organization_id, 'org_456');
    assert.strictEqual(result.internal_notes, 'Internal admin notes here');

  });


  it('should merge with base data methods', function () {

    // Both base and server methods should be available
    assert.strictEqual(typeof Survey.data.create, 'function', 'Base create method should exist');
    assert.strictEqual(typeof Survey.data.addServerFields, 'function', 'Server addServerFields method should exist');
    assert.strictEqual(typeof Survey.data.toPublic, 'function', 'Base toPublic method should exist');

  });

});




describe('Survey Server Model - Validation', function () {

  it('should have server validation methods available', function () {

    assert.ok(Survey.validation, 'Survey.validation should exist');
    assert.strictEqual(typeof Survey.validation.validatePublish, 'function', 'validatePublish should be a function');
    assert.strictEqual(typeof Survey.validation.validateClose, 'function', 'validateClose should be a function');

  });


  it('should have base validation methods merged', function () {

    assert.strictEqual(typeof Survey.validation.validateCreate, 'function', 'Base validateCreate should be merged');

  });

});




describe('Survey Server Model - Process', function () {

  it('should have server process methods available', function () {

    assert.ok(Survey.process, 'Survey.process should exist');
    assert.strictEqual(typeof Survey.process.calculateStats, 'function', 'calculateStats should be a function');
    assert.strictEqual(typeof Survey.process.archiveSurvey, 'function', 'archiveSurvey should be a function');

  });

});




describe('Survey Server Model - Server-Only Errors', function () {

  it('should have server error codes available', function () {

    assert.ok(Survey.errors, 'Survey.errors should exist');
    assert.ok(Survey.errors.QUOTA_EXCEEDED, 'QUOTA_EXCEEDED should exist');
    assert.ok(Survey.errors.PUBLISH_NOT_ALLOWED, 'PUBLISH_NOT_ALLOWED should exist');
    assert.ok(Survey.errors.ALREADY_PUBLISHED, 'ALREADY_PUBLISHED should exist');
    assert.ok(Survey.errors.CLOSE_NOT_ALLOWED, 'CLOSE_NOT_ALLOWED should exist');

  });

});
