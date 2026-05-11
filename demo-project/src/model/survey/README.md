# Survey Base Model

Shared domain model for the Survey entity. Demonstrates complex nested structures with cross-referencing.

**Hierarchy:** Survey → Questions → Options, with conditional Rules that cross-reference between questions.

## Overview

The Survey model represents a complete survey definition including questions, response options, and conditional logic rules.

## Data Attributes

### Survey Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | String | Yes | - | Unique identifier |
| `title` | String | Yes | - | Survey title (max 200 chars) |
| `description` | String | No | null | Survey description (max 1000 chars) |
| `status` | String | Yes | 'draft' | 'draft', 'active', 'paused', 'closed' |
| `questions` | Array | Yes | [] | Array of Question objects |
| `rules` | Array | No | [] | Conditional logic rules |
| `created_at` | ISO String | Yes | now | Creation timestamp |
| `updated_at` | ISO String | Yes | now | Last update timestamp |

### Question Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `question_id` | String | Yes | Unique within survey |
| `text` | String | Yes | Question text (max 500 chars) |
| `type` | String | Yes | 'text', 'number', 'single_choice', 'multi_choice', 'scale', 'date' |
| `order` | Number | Yes | Display order (0-based) |
| `is_required` | Boolean | No | Whether answer is required (default: false) |
| `options` | Array | Conditional | Required for choice types, forbidden for others |
| `constraints` | Object | No | Type-specific constraints (min, max, etc.) |

### Option Attributes (for choice questions)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `option_id` | String | Yes | Unique within question |
| `label` | String | Yes | Display label |
| `order` | Number | Yes | Display order |
| `value` | String/Number | No | Stored value (defaults to trimmed label) |

### Rule Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_question_id` | String | Yes | Question that triggers the rule |
| `operator` | String | Yes | 'equals', 'not_equals', 'contains', 'greater_than', 'less_than' |
| `value` | Any | Yes | Value to compare against |
| `action` | String | Yes | 'show', 'hide', 'require', 'skip_to' |
| `target_question_id` | String | Yes | Question affected by the action |

## Module Files

| File | Purpose |
|---|---|
| `index.js` | Public export surface (Standard Loader) |
| `survey.config.js` | Domain constants (lengths, types, operators, actions) |
| `survey.data.js` | **Consolidated: Data shapes + transformations** |
| `survey.errors.js` | Domain error catalog (survey, question, option, rule errors) |
| `survey.validation.js` | Nested validation with type-dependent and cross-reference checks |
| `survey.process.js` | Statistics, reporting, response analysis |

## Exported Functions

### Data (`model.data`)
- **`create(title, description, questions)`** → Canonical survey data
- **`createQuestion(question_id, text, type, order, is_required, options, constraints)`** → question data
- **`createOption(option_id, label, order, value)`** → option data
- **`createRule(source_question_id, operator, value, action, target_question_id)`** → rule data
- **`createUpdate(data)`** → partial update shape
- **`createDeep(survey_data, responses?, statistics?, metadata?)`** → deep data assembly
- **`toPublic(survey_data)`** → public version (strips server-only fields)
- **`toSummary(survey_data)`** → minimal summary for list views
- **`toInternal(external_data)`** → transforms external input to internal shape
- **`question.toPublic(question_data)`** → public question output
- **`question.toSummary(question_data)`** → question summary
- **`option.toPublic(option_data)`** → public option output

### Validation (`model.validation`)
- **`validateCreate(data)`** → `false` if valid, `Error[]` if invalid
- **`validateQuestion(question)`** → validates single question with type-dependent logic
- **`validateOption(option)`** → validates single option
- **`validateRule(rule, valid_question_ids)`** → validates rule cross-references
- **`validateUpdate(data)`** → validates partial update

### Process (`model.process`) - Statistics and Analysis
- **`calculateCompletionPercentage(survey_data, responses)`** - Calculate % of questions answered
- **`calculateStatistics(responses, survey_config)`** - Generate response statistics
- **`calculateQuestionStats(responses, question)`** - Statistics for a single question
- **`calculateAverageRating(answers)`** - Average of numeric rating answers
- **`calculateRatingDistribution(answers, question)`** - Count distribution across rating scale
- **`calculateChoiceDistribution(answers, question)`** - Count distribution for choice options
- **`calculateAverageTextLength(answers)`** - Average length of text responses
- **`buildSurveySummary(survey_data, responses)`** - Summary for list views
- **`validateResponseCompleteness(response, survey_config)`** - Check if all required questions answered
- **`generateReportData(survey_data, responses)`** - Generate full report with all statistics
- **`filterResponses(responses, filters)`** - Filter by status, date range, completion %

## Usage

```javascript
// Load model via parent loader
const loadLib = require('../_test/loader');
const Lib = loadLib();
const Survey = Lib.Survey;

// Create survey
const survey = Survey.data.create('Feedback Survey', 'Your thoughts matter');

// Add question
const question = Survey.data.createQuestion('q1', 'How are you?', 'scale', 0, true);
survey.questions.push(question);

// Public output
const output = Survey.data.toPublic(survey);
```

## Dependencies
- `Lib.Utils`: For string and object utilities
- `CONFIG`: Internal entity configuration (loaded within module, not exported)

## Question Types
`text` | `number` | `single_choice` | `multi_choice` | `scale` | `date`

## Rule Operators
`equals` | `not_equals` | `contains` | `greater_than` | `less_than`

## Rule Actions
`show` | `hide` | `require` | `skip_to`
