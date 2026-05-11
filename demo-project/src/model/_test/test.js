// Info: Global Model Test Suite
// Uses simulating loader to test all models with proper cross-module dependencies
'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Load simulating loader
const loadLib = require('./loader');

// Global test setup
test('Model Loader', async function(t) {

  await t.test('should load all models without errors', function() {
    const Lib = loadLib();

    assert.ok(Lib.Utils, 'Utils should be loaded');
    assert.ok(Lib.Debug, 'Debug should be loaded');
    assert.ok(Lib.Contact, 'Contact should be loaded');
    assert.ok(Lib.User, 'User should be loaded');
    assert.ok(Lib.Survey, 'Survey should be loaded');
    assert.ok(Lib.Shared, 'Shared should be loaded');
    assert.ok(Lib.Shared.process, 'Shared.process should be loaded');
  });

  await t.test('should inject Lib into ContactProcess', function() {
    const Lib = loadLib();

    assert.ok(Lib.Contact.process, 'Contact.process should be injected');
    assert.strictEqual(typeof Lib.Contact.process.formatPhoneNumber, 'function', 'formatPhoneNumber should be a function');
  });

  await t.test('should inject Lib into UserProcess', function() {
    const Lib = loadLib();

    assert.ok(Lib.User.process, 'User.process should be injected');
    assert.strictEqual(typeof Lib.User.process.calculateActivityScore, 'function', 'calculateActivityScore should be a function');
  });

  await t.test('should inject Lib into SurveyProcess', function() {
    const Lib = loadLib();

    assert.ok(Lib.Survey.process, 'Survey.process should be injected');
    assert.strictEqual(typeof Lib.Survey.process.calculateCompletionPercentage, 'function', 'calculateCompletionPercentage should be a function');
  });

  await t.test('should allow cross-module dependencies', function() {
    const Lib = loadLib();

    // User.process uses Utils.isEmpty (from Lib)
    const score = Lib.User.process.calculateActivityScore({
      login_count: 10,
      survey_count: 5,
      days_since_last_login: 2
    });

    assert.strictEqual(typeof score, 'number', 'Activity score should be calculated');
    assert.ok(score > 0, 'Score should be positive');
  });

});
