// Info: Test Cases for Shared server model extension
// Uses simulating loader pattern for proper dependency injection
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load models via simulating loader (proper DI pattern)
const loadLib = require('../../_test/loader');
const Lib = loadLib();
const Shared = Lib.Shared;



describe('Shared Server Model - Structure', function () {

  it('should have all expected namespaces after merge', function () {

    assert.ok(Shared.data, 'Shared.data should exist');
    assert.ok(Shared.errors, 'Shared.errors should exist');
    assert.ok(Shared.process, 'Shared.process should exist');
    assert.ok(Shared.validation, 'Shared.validation should exist');

  });


  it('should preserve base Shared config after merge', function () {

    assert.ok(Shared.config, 'Shared.config should be preserved');

  });

});



describe('Shared Server Model - Merge Pattern', function () {

  it('should have base data methods available', function () {

    // Base Shared model has data methods — they should survive the merge
    assert.ok(Shared.data !== undefined, 'Shared.data should exist after merge');

  });


  it('should have base process methods available', function () {

    assert.ok(Shared.process !== undefined, 'Shared.process should exist after merge');

  });


  it('should have base validation methods available', function () {

    assert.ok(Shared.validation !== undefined, 'Shared.validation should exist after merge');

  });

});
