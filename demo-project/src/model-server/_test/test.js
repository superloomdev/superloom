// Info: Global Model-Server Test Suite
// Tests that server extensions load and merge correctly with base models
'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Load simulating loader
const loadLib = require('./loader');

// Global test setup
test('Model-Server Loader', async function(t) {

  await t.test('should load all base models without errors', function() {
    const Lib = loadLib();

    assert.ok(Lib.Utils, 'Utils should be loaded');
    assert.ok(Lib.Debug, 'Debug should be loaded');
    assert.ok(Lib.Contact, 'Contact should be loaded');
    assert.ok(Lib.User, 'User should be loaded');
    assert.ok(Lib.Survey, 'Survey should be loaded');
    assert.ok(Lib.Shared, 'Shared should be loaded');
  });

  await t.test('should have Survey data with base methods', function() {
    const Lib = loadLib();

    assert.ok(Lib.Survey.data, 'Survey.data should exist');
    assert.strictEqual(typeof Lib.Survey.data.create, 'function', 'Survey.data.create should be a function');
    assert.strictEqual(typeof Lib.Survey.data.toPublic, 'function', 'Survey.data.toPublic should be a function');
  });

  await t.test('should have Survey validation with base methods', function() {
    const Lib = loadLib();

    assert.ok(Lib.Survey.validation, 'Survey.validation should exist');
    assert.strictEqual(typeof Lib.Survey.validation.validateCreate, 'function', 'validateCreate should be a function');
  });

  await t.test('should have Shared data with base methods', function() {
    const Lib = loadLib();

    assert.ok(Lib.Shared.data, 'Shared.data should exist');
    assert.ok(Lib.Shared.process, 'Shared.process should exist');
  });

  await t.test('should allow cross-module dependencies', function() {
    const Lib = loadLib();

    // Survey can reference Lib.Contact, Lib.User
    assert.ok(Lib.Contact.data, 'Contact.data should be available for Survey dependencies');
    assert.ok(Lib.User.data, 'User.data should be available for Survey dependencies');
  });

});
