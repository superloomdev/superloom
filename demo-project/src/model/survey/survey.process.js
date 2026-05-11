// Info: Survey Process Module - Pure business logic and data transformations for Survey entity
// No database interaction - just data manipulation and calculations
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;

/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return SurveyProcess;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyProcess = {

  /********************************************************************
  Calculate survey completion percentage

  @param {Object} survey_data - Survey data object
  @param {Array} survey_data.questions - Array of questions
  @param {Array} [responses] - Array of responses (optional)

  @return {Number} - Completion percentage (0-100)
  *********************************************************************/
  calculateCompletionPercentage: function (survey_data, responses) {

    if (Lib.Utils.isEmpty(survey_data.questions)) {
      return 0;
    }

    const total_questions = survey_data.questions.length;

    if (Lib.Utils.isEmpty(responses)) {
      return 0;
    }

    const answered_questions = responses.filter(function (r) {
      return !Lib.Utils.isEmpty(r.answer);
    }).length;

    return Math.round((answered_questions / total_questions) * 100);

  },


  /********************************************************************
  Calculate survey statistics from responses

  @param {Array} responses - Array of response objects
  @param {Object} survey_config - Survey configuration

  @return {Object} - Statistics object
  *********************************************************************/
  calculateStatistics: function (responses, survey_config) {

    const stats = {
      total_responses: responses.length,
      completion_rate: 0,
      average_time_seconds: 0,
      question_stats: {}
    };

    if (responses.length === 0) {
      return stats;
    }

    // Calculate completion rate
    const completed = responses.filter(function (r) {
      return r.status === 'completed';
    }).length;
    stats.completion_rate = Math.round((completed / responses.length) * 100);

    // Calculate average time
    const total_time = responses.reduce(function (sum, r) {
      return sum + (r.time_spent_seconds || 0);
    }, 0);
    stats.average_time_seconds = Math.round(total_time / responses.length);

    // Calculate per-question statistics
    if (survey_config && survey_config.questions) {
      survey_config.questions.forEach(function (question) {
        stats.question_stats[question.id] = SurveyProcess.calculateQuestionStats(
          responses,
          question
        );
      });
    }

    return stats;

  },


  /********************************************************************
  Calculate statistics for a single question

  @param {Array} responses - Array of response objects
  @param {Object} question - Question configuration

  @return {Object} - Question statistics
  *********************************************************************/
  calculateQuestionStats: function (responses, question) {

    const stats = {
      question_id: question.id,
      question_type: question.type,
      total_answers: 0,
      skipped: 0
    };

    // Collect answers for this question
    const answers = [];
    responses.forEach(function (response) {
      const answer = response.answers ? response.answers[question.id] : null;
      if (Lib.Utils.isEmpty(answer)) {
        stats.skipped++;
      } else {
        answers.push(answer);
        stats.total_answers++;
      }
    });

    // Calculate type-specific stats
    switch (question.type) {
    case 'rating':
      stats.average_rating = SurveyProcess.calculateAverageRating(answers);
      stats.rating_distribution = SurveyProcess.calculateRatingDistribution(answers, question);
      break;

    case 'choice':
    case 'multichoice':
      stats.choice_distribution = SurveyProcess.calculateChoiceDistribution(answers, question);
      break;

    case 'text':
      stats.average_length = SurveyProcess.calculateAverageTextLength(answers);
      break;
    }

    return stats;

  },


  /********************************************************************
  Calculate average rating from array of numeric answers

  @param {Array} answers - Array of numeric answers

  @return {Number} - Average rating (rounded to 1 decimal)
  *********************************************************************/
  calculateAverageRating: function (answers) {

    if (Lib.Utils.isEmpty(answers)) {
      return 0;
    }

    const numeric_answers = answers.filter(function (a) {
      return typeof a === 'number';
    });

    if (numeric_answers.length === 0) {
      return 0;
    }

    const sum = numeric_answers.reduce(function (acc, val) {
      return acc + val;
    }, 0);

    return Math.round((sum / numeric_answers.length) * 10) / 10;

  },


  /********************************************************************
  Calculate rating distribution

  @param {Array} answers - Array of numeric answers
  @param {Object} question - Question with min/max scale

  @return {Object} - Distribution by rating value
  *********************************************************************/
  calculateRatingDistribution: function (answers, question) {

    const distribution = {};
    const min = question.min_value || 1;
    const max = question.max_value || 5;

    // Initialise all possible values
    for (let i = min; i <= max; i++) {
      distribution[i] = 0;
    }

    // Count occurrences
    answers.forEach(function (answer) {
      if (typeof answer === 'number' && answer >= min && answer <= max) {
        distribution[answer] = (distribution[answer] || 0) + 1;
      }
    });

    return distribution;

  },


  /********************************************************************
  Calculate choice distribution

  @param {Array} answers - Array of choice answers (single or multiple)
  @param {Object} question - Question with options

  @return {Object} - Distribution by option
  *********************************************************************/
  calculateChoiceDistribution: function (answers, question) {

    const distribution = {};

    // Initialise options
    if (question.options) {
      question.options.forEach(function (opt) {
        distribution[opt.value || opt.id] = 0;
      });
    }

    // Count occurrences
    answers.forEach(function (answer) {
      if (Array.isArray(answer)) {
        // Multi-choice: array of values
        answer.forEach(function (val) {
          distribution[val] = (distribution[val] || 0) + 1;
        });
      } else {
        // Single choice: single value
        distribution[answer] = (distribution[answer] || 0) + 1;
      }
    });

    return distribution;

  },


  /********************************************************************
  Calculate average text answer length

  @param {Array} answers - Array of text answers

  @return {Number} - Average length
  *********************************************************************/
  calculateAverageTextLength: function (answers) {

    if (Lib.Utils.isEmpty(answers)) {
      return 0;
    }

    const lengths = answers
      .filter(function (a) {
        return typeof a === 'string';
      })
      .map(function (a) {
        return a.length;
      });

    if (lengths.length === 0) {
      return 0;
    }

    const sum = lengths.reduce(function (acc, len) {
      return acc + len;
    }, 0);

    return Math.round(sum / lengths.length);

  },


  /********************************************************************
  Build survey summary for list views

  @param {Object} survey_data - Full survey data
  @param {Array} [responses] - Optional responses for stat calculation

  @return {Object} - Survey summary
  *********************************************************************/
  buildSurveySummary: function (survey_data, responses) {

    const summary = {
      id: survey_data.id,
      title: survey_data.title,
      description: survey_data.description,
      status: survey_data.status,
      question_count: survey_data.questions ? survey_data.questions.length : 0,
      created_at: survey_data.created_at,
      updated_at: survey_data.updated_at
    };

    if (!Lib.Utils.isEmpty(responses)) {
      summary.response_count = responses.length;
      summary.stats = SurveyProcess.calculateStatistics(responses, survey_data);
    }

    return summary;

  },


  /********************************************************************
  Validate if a response is complete

  @param {Object} response - Response data
  @param {Object} survey_config - Survey configuration with required questions

  @return {Object} - Validation result { is_complete: Boolean, missing_questions: Array }
  *********************************************************************/
  validateResponseCompleteness: function (response, survey_config) {

    const result = {
      is_complete: true,
      missing_questions: []
    };

    if (Lib.Utils.isEmpty(survey_config.questions)) {
      return result;
    }

    const answers = response.answers || {};

    survey_config.questions.forEach(function (question) {
      if (question.required) {
        const answer = answers[question.id];
        if (Lib.Utils.isEmpty(answer)) {
          result.is_complete = false;
          result.missing_questions.push(question.id);
        }
      }
    });

    return result;

  },


  /********************************************************************
  Generate survey report data

  @param {Object} survey_data - Survey configuration
  @param {Array} responses - All responses

  @return {Object} - Report data structure
  *********************************************************************/
  generateReportData: function (survey_data, responses) {

    const report = {
      survey_id: survey_data.id,
      survey_title: survey_data.title,
      generated_at: new Date().toISOString(),
      summary: {
        total_questions: survey_data.questions ? survey_data.questions.length : 0,
        total_responses: responses.length,
        completed_responses: 0,
        partial_responses: 0
      },
      statistics: SurveyProcess.calculateStatistics(responses, survey_data),
      question_details: {}
    };

    // Count completion status
    responses.forEach(function (r) {
      if (r.status === 'completed') {
        report.summary.completed_responses++;
      } else {
        report.summary.partial_responses++;
      }
    });

    // Detailed question analysis
    if (survey_data.questions) {
      survey_data.questions.forEach(function (question) {
        report.question_details[question.id] = {
          question_text: question.text,
          question_type: question.type,
          stats: SurveyProcess.calculateQuestionStats(responses, question)
        };
      });
    }

    return report;

  },


  /********************************************************************
  Filter responses by criteria

  @param {Array} responses - Array of response objects
  @param {Object} filters - Filter criteria
  @param {String} [filters.status] - Status filter (completed, partial)
  @param {String} [filters.date_from] - Start date (ISO string)
  @param {String} [filters.date_to] - End date (ISO string)
  @param {Number} [filters.min_completion_pct] - Minimum completion percentage

  @return {Array} - Filtered responses
  *********************************************************************/
  filterResponses: function (responses, filters) {

    return responses.filter(function (response) {

      if (filters.status && response.status !== filters.status) {
        return false;
      }

      if (filters.date_from) {
        const from_date = new Date(filters.date_from);
        const response_date = new Date(response.created_at);
        if (response_date < from_date) {
          return false;
        }
      }

      if (filters.date_to) {
        const to_date = new Date(filters.date_to);
        const response_date = new Date(response.created_at);
        if (response_date > to_date) {
          return false;
        }
      }

      if (filters.min_completion_pct !== undefined) {
        const completion = response.completion_percentage || 0;
        if (completion < filters.min_completion_pct) {
          return false;
        }
      }

      return true;

    });

  }

};///////////////////////////Public Functions END///////////////////////////////
