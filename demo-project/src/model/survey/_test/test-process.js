// Info: Tests for SurveyProcess module
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Mock Lib object
const mockLib = {
  Utils: {
    isEmpty: function (val) {
      return val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && Object.keys(val).length === 0);
    }
  }
};

const SurveyProcess = require('../survey.process')(mockLib);

describe('SurveyProcess', function () {

  describe('calculateCompletionPercentage', function () {
    const survey_data = {
      questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }]
    };

    it('should return 0 for no responses', function () {
      const result = SurveyProcess.calculateCompletionPercentage(survey_data, []);
      assert.strictEqual(result, 0);
    });

    it('should calculate 50% for half answered', function () {
      const responses = [
        { question_id: 'q1', answer: 'A' },
        { question_id: 'q2', answer: 'B' },
        { question_id: 'q3', answer: null },
        { question_id: 'q4', answer: undefined }
      ];
      const result = SurveyProcess.calculateCompletionPercentage(survey_data, responses);
      assert.strictEqual(result, 50);
    });

    it('should return 100% for all answered', function () {
      const responses = [
        { question_id: 'q1', answer: 'A' },
        { question_id: 'q2', answer: 'B' },
        { question_id: 'q3', answer: 'C' },
        { question_id: 'q4', answer: 'D' }
      ];
      const result = SurveyProcess.calculateCompletionPercentage(survey_data, responses);
      assert.strictEqual(result, 100);
    });
  });

  describe('calculateStatistics', function () {
    it('should return default stats for empty responses', function () {
      const result = SurveyProcess.calculateStatistics([], {});
      assert.strictEqual(result.total_responses, 0);
      assert.strictEqual(result.completion_rate, 0);
    });

    it('should calculate completion rate', function () {
      const responses = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'partial' }
      ];
      const result = SurveyProcess.calculateStatistics(responses, {});
      assert.strictEqual(result.total_responses, 3);
      assert.strictEqual(result.completion_rate, 67);
    });

    it('should calculate average time', function () {
      const responses = [
        { status: 'completed', time_spent_seconds: 60 },
        { status: 'completed', time_spent_seconds: 120 },
        { status: 'partial', time_spent_seconds: 30 }
      ];
      const result = SurveyProcess.calculateStatistics(responses, {});
      assert.strictEqual(result.average_time_seconds, 70);
    });
  });

  describe('calculateAverageRating', function () {
    it('should calculate average rating', function () {
      const result = SurveyProcess.calculateAverageRating([3, 4, 5, 4, 3]);
      assert.strictEqual(result, 3.8);
    });

    it('should return 0 for empty array', function () {
      const result = SurveyProcess.calculateAverageRating([]);
      assert.strictEqual(result, 0);
    });

    it('should filter out non-numeric values', function () {
      const result = SurveyProcess.calculateAverageRating([4, 'great', 5, null]);
      assert.strictEqual(result, 4.5);
    });
  });

  describe('calculateRatingDistribution', function () {
    it('should count rating occurrences', function () {
      const question = { min_value: 1, max_value: 5 };
      const result = SurveyProcess.calculateRatingDistribution([1, 2, 2, 3, 3, 3, 4, 5], question);
      assert.strictEqual(result[1], 1);
      assert.strictEqual(result[2], 2);
      assert.strictEqual(result[3], 3);
      assert.strictEqual(result[4], 1);
      assert.strictEqual(result[5], 1);
    });

    it('should initialise all possible values', function () {
      const question = { min_value: 1, max_value: 3 };
      const result = SurveyProcess.calculateRatingDistribution([], question);
      assert.strictEqual(result[1], 0);
      assert.strictEqual(result[2], 0);
      assert.strictEqual(result[3], 0);
    });
  });

  describe('calculateChoiceDistribution', function () {
    it('should count single choice selections', function () {
      const question = { options: [{ value: 'A' }, { value: 'B' }, { value: 'C' }] };
      const result = SurveyProcess.calculateChoiceDistribution(['A', 'B', 'A', 'A', 'C'], question);
      assert.strictEqual(result['A'], 3);
      assert.strictEqual(result['B'], 1);
      assert.strictEqual(result['C'], 1);
    });

    it('should count multi-choice selections', function () {
      const question = { options: [{ value: 'red' }, { value: 'blue' }, { value: 'green' }] };
      const result = SurveyProcess.calculateChoiceDistribution([
        ['red', 'blue'],
        ['red'],
        ['blue', 'green']
      ], question);
      assert.strictEqual(result['red'], 2);
      assert.strictEqual(result['blue'], 2);
      assert.strictEqual(result['green'], 1);
    });
  });

  describe('calculateAverageTextLength', function () {
    it('should calculate average text length', function () {
      const result = SurveyProcess.calculateAverageTextLength(['hello', 'world', 'test']);
      assert.strictEqual(result, 5); // (5+5+4)/3 = 4.67 rounded to 5
    });

    it('should return 0 for empty array', function () {
      const result = SurveyProcess.calculateAverageTextLength([]);
      assert.strictEqual(result, 0);
    });

    it('should filter out non-string values', function () {
      const result = SurveyProcess.calculateAverageTextLength(['hello', 123, null, 'world']);
      assert.strictEqual(result, 5);
    });
  });

  describe('buildSurveySummary', function () {
    it('should build summary from survey data', function () {
      const survey_data = {
        id: 'srv_123',
        title: 'Customer Feedback',
        description: 'Help us improve',
        status: 'active',
        questions: [{ id: 'q1' }, { id: 'q2' }],
        created_at: '2021-01-01T00:00:00Z',
        updated_at: '2021-06-01T00:00:00Z'
      };

      const summary = SurveyProcess.buildSurveySummary(survey_data);

      assert.strictEqual(summary.id, 'srv_123');
      assert.strictEqual(summary.title, 'Customer Feedback');
      assert.strictEqual(summary.question_count, 2);
      assert.strictEqual(summary.status, 'active');
    });
  });

  describe('validateResponseCompleteness', function () {
    const survey_config = {
      questions: [
        { id: 'q1', required: true },
        { id: 'q2', required: true },
        { id: 'q3', required: false }
      ]
    };

    it('should return complete for all required answered', function () {
      const response = {
        answers: { q1: 'Answer 1', q2: 'Answer 2' }
      };
      const result = SurveyProcess.validateResponseCompleteness(response, survey_config);
      assert.strictEqual(result.is_complete, true);
      assert.strictEqual(result.missing_questions.length, 0);
    });

    it('should return incomplete for missing required', function () {
      const response = {
        answers: { q1: 'Answer 1' }
      };
      const result = SurveyProcess.validateResponseCompleteness(response, survey_config);
      assert.strictEqual(result.is_complete, false);
      assert.ok(result.missing_questions.includes('q2'));
    });
  });

  describe('generateReportData', function () {
    it('should generate report with summary stats', function () {
      const survey_data = {
        id: 'srv_123',
        title: 'Test Survey',
        questions: [{ id: 'q1', type: 'rating', text: 'Rate us' }]
      };
      const responses = [
        { status: 'completed', answers: { q1: 5 }, created_at: '2021-01-01' },
        { status: 'partial', answers: { q1: 4 }, created_at: '2021-01-02' }
      ];

      const report = SurveyProcess.generateReportData(survey_data, responses);

      assert.strictEqual(report.survey_id, 'srv_123');
      assert.strictEqual(report.summary.total_responses, 2);
      assert.strictEqual(report.summary.completed_responses, 1);
      assert.strictEqual(report.summary.partial_responses, 1);
      assert.ok(report.statistics);
      assert.ok(report.question_details.q1);
    });
  });

  describe('filterResponses', function () {
    const responses = [
      { status: 'completed', created_at: '2021-06-15', completion_percentage: 100 },
      { status: 'partial', created_at: '2021-06-10', completion_percentage: 50 },
      { status: 'completed', created_at: '2021-06-01', completion_percentage: 100 }
    ];

    it('should filter by status', function () {
      const result = SurveyProcess.filterResponses(responses, { status: 'completed' });
      assert.strictEqual(result.length, 2);
    });

    it('should filter by date range', function () {
      const result = SurveyProcess.filterResponses(responses, {
        date_from: '2021-06-10',
        date_to: '2021-06-20'
      });
      assert.strictEqual(result.length, 2);
    });

    it('should filter by min completion percentage', function () {
      const result = SurveyProcess.filterResponses(responses, { min_completion_pct: 75 });
      assert.strictEqual(result.length, 2);
    });
  });

});
