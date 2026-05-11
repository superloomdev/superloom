// Info: Global Model-Client Test Suite
// Tests that client extensions load and merge correctly with base models
'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Load simulating loader
const loadLib = require('./loader');

// Global test setup
test('Model-Client Loader', async function(t) {

  await t.test('should load all base models without errors', function() {
    const Lib = loadLib();

    assert.ok(Lib.Utils, 'Utils should be loaded');
    assert.ok(Lib.Debug, 'Debug should be loaded');
    assert.ok(Lib.Contact, 'Contact should be loaded');
    assert.ok(Lib.User, 'User should be loaded');
    assert.ok(Lib.Survey, 'Survey should be loaded');
  });

  await t.test('should have Survey data with base methods', function() {
    const Lib = loadLib();

    assert.ok(Lib.Survey.data, 'Survey.data should exist');
    assert.strictEqual(typeof Lib.Survey.data.create, 'function', 'Survey.data.create should be a function');
    assert.strictEqual(typeof Lib.Survey.data.toPublic, 'function', 'Survey.data.toPublic should be a function');
  });

  await t.test('should have Survey data with client methods', function() {
    const Lib = loadLib();

    // Client methods
    assert.strictEqual(typeof Lib.Survey.data.addClientFields, 'function', 'addClientFields should be a function');
    assert.strictEqual(typeof Lib.Survey.data.toCache, 'function', 'toCache should be a function');
    assert.strictEqual(typeof Lib.Survey.data.isStale, 'function', 'isStale should be a function');
  });

  await t.test('should have Survey process with client methods', function() {
    const Lib = loadLib();

    assert.ok(Lib.Survey.process, 'Survey.process should exist');
    assert.strictEqual(typeof Lib.Survey.process.secondsSinceFetch, 'function', 'secondsSinceFetch should be a function');
    assert.strictEqual(typeof Lib.Survey.process.needsRefresh, 'function', 'needsRefresh should be a function');
    assert.strictEqual(typeof Lib.Survey.process.formatLastFetched, 'function', 'formatLastFetched should be a function');
  });

  await t.test('should allow cross-module dependencies', function() {
    const Lib = loadLib();

    // Survey can reference Lib.Contact, Lib.User
    assert.ok(Lib.Contact.data, 'Contact.data should be available for Survey dependencies');
    assert.ok(Lib.User.data, 'User.data should be available for Survey dependencies');
  });

});
