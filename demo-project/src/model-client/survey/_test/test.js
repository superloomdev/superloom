// Info: Test Cases for Survey client model extension
// Uses simulating loader pattern for proper dependency injection
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load models via simulating loader (proper DI pattern)
const loadLib = require('../../_test/loader');
const Lib = loadLib();
const Survey = Lib.Survey;



describe('Survey Client Model - Data', function () {

  it('should add client-only fields to a base survey entity', function () {

    const base_survey = {
      title: 'Test Survey',
      status: 'draft'
    };

    const now = Date.now();
    const result = Survey.data.addClientFields(base_survey, now, 'fresh');

    // Base fields preserved
    assert.strictEqual(result.title, 'Test Survey');
    assert.strictEqual(result.status, 'draft');

    // Client-only fields added
    assert.strictEqual(result._last_fetched_at, now);
    assert.strictEqual(result._cache_status, 'fresh');
    assert.strictEqual(result._client_version, 1);

  });


  it('should default cache_status to unknown if not provided', function () {

    const base_survey = { title: 'Test', status: 'draft' };
    const result = Survey.data.addClientFields(base_survey, Date.now(), null);

    assert.strictEqual(result._cache_status, 'unknown');

  });


  it('should build lightweight cache version', function () {

    const full_survey = {
      id: 'survey_123',
      title: 'Full Survey',
      status: 'active',
      questions: [{ q: 1 }, { q: 2 }, { q: 3 }],
      rules: [{ r: 1 }],
      created_at: 1000
    };

    const cached_at = Date.now();
    const result = Survey.data.toCache(full_survey, cached_at);

    assert.strictEqual(result.id, 'survey_123');
    assert.strictEqual(result.title, 'Full Survey');
    assert.strictEqual(result.question_count, 3);
    assert.strictEqual(result._cached_at, cached_at);
    assert.strictEqual(result._cache_ttl, 5 * 60 * 1000);

    // Heavy fields stripped
    assert.strictEqual(result.questions, undefined);
    assert.strictEqual(result.rules, undefined);

  });


  it('should detect stale cache correctly', function () {

    const now = Date.now();
    const fresh_cache = { _cached_at: now - 1000, _cache_ttl: 60000 };
    const stale_cache = { _cached_at: now - 400000, _cache_ttl: 300000 };

    assert.strictEqual(Survey.data.isStale(fresh_cache, now), false);
    assert.strictEqual(Survey.data.isStale(stale_cache, now), true);

  });


  it('should merge with base data methods', function () {

    // Both base and client methods should be available
    assert.strictEqual(typeof Survey.data.create, 'function', 'Base create method should exist');
    assert.strictEqual(typeof Survey.data.addClientFields, 'function', 'Client addClientFields method should exist');
    assert.strictEqual(typeof Survey.data.toPublic, 'function', 'Base toPublic method should exist');

  });

});



describe('Survey Client Model - Process', function () {

  it('should calculate seconds since fetch correctly', function () {

    const now = 1000000;
    const last_fetch = 900000;

    const result = Survey.process.secondsSinceFetch(last_fetch, now);

    assert.strictEqual(result, 100);  // (1000000 - 900000) / 1000

  });


  it('should return Infinity for missing last_fetch', function () {

    const result = Survey.process.secondsSinceFetch(null, Date.now());

    assert.strictEqual(result, Infinity);

  });


  it('should determine refresh needed based on age', function () {

    const now = Date.now();
    const fresh = { _last_fetched_at: now - 1000 };
    const stale = { _last_fetched_at: now - (10 * 60 * 1000) };  // 10 minutes

    assert.strictEqual(Survey.process.needsRefresh(fresh, now), false);
    assert.strictEqual(Survey.process.needsRefresh(stale, now), true);

  });


  it('should format last fetched time for display', function () {

    const now = Date.now();

    assert.strictEqual(Survey.process.formatLastFetched(null), 'never');
    assert.strictEqual(Survey.process.formatLastFetched(now - 30000), 'just now');
    assert.strictEqual(Survey.process.formatLastFetched(now - 120000), '2 minutes ago');
    assert.strictEqual(Survey.process.formatLastFetched(now - 7200000), '2 hours ago');

  });

});



describe('Survey Client Model - Validation', function () {

  it('should have client validation methods available', function () {

    assert.ok(Survey.validation, 'Survey.validation should exist');
    assert.strictEqual(typeof Survey.validation.validateCacheStatus, 'function', 'validateCacheStatus should be a function');
    assert.strictEqual(typeof Survey.validation.validateCachedSurvey, 'function', 'validateCachedSurvey should be a function');

  });


  it('should validate cache status values', function () {

    assert.strictEqual(Survey.validation.validateCacheStatus('fresh'), null);
    assert.strictEqual(Survey.validation.validateCacheStatus('stale'), null);
    assert.strictEqual(Survey.validation.validateCacheStatus('miss'), null);
    assert.strictEqual(Survey.validation.validateCacheStatus('invalid').code, 'INVALID_CACHE_STATUS');

  });


  it('should detect invalid cached survey', function () {

    const result = Survey.validation.validateCachedSurvey(null);

    assert.strictEqual(result.is_valid, false);
    assert.strictEqual(result.error.code, 'SURVEY_CACHE_MISS');

  });

});



describe('Survey Client Model - Errors', function () {

  it('should have client error codes', function () {

    assert.ok(Survey.errors, 'Survey.errors should exist');
    assert.ok(Survey.errors.CACHE_MISS, 'CACHE_MISS should exist');
    assert.ok(Survey.errors.CACHE_EXPIRED, 'CACHE_EXPIRED should exist');
    assert.ok(Survey.errors.SYNC_CONFLICT, 'SYNC_CONFLICT should exist');

  });

});
