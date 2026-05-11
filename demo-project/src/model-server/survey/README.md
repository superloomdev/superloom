# Survey Server Model Extension

Server-only extensions over the Survey base model. Adds fields and logic not shared with clients.

## Exported Functions

- **`addServerFields(survey, created_by, organization_id)`** - Extends base survey data with server-only fields: `created_by`, `organization_id`, `response_count`, `is_published`, `published_at`, `closed_at`, `internal_notes`, `version`
- **`addServerUpdateFields(base_update, updated_by)`** - Adds `updated_by` and `version_increment` to an update shape
- **`buildAdminOutput(id, survey, response_count)`** - Full admin data object including all server-only fields

## Server-Only Errors
- `QUOTA_EXCEEDED` - Organization has reached maximum surveys
- `PUBLISH_NOT_ALLOWED` - Survey cannot be published in current state
- `ALREADY_PUBLISHED` - Survey is already published
- `CLOSE_NOT_ALLOWED` - Only published surveys can be closed

## Dependencies
- `src/model/survey` (base model)
