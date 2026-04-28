# AWS EventBridge Scheduled Tasks Setup

> Reference: docs/ops/scheduled-tasks/aws-eventbridge-setup.md

## Prerequisites

- Completed: `05-identity-access/`, `15-deployment/`

## Steps

### Create Scheduled Rules

EventBridge rules can trigger Lambda functions on a schedule.

* EventBridge → Rules → Create Rule
* Name: `[TODO: project]-[task-name]-schedule`
* Description: `[TODO: What this scheduled task does]`
* Schedule Expression:
  * Cron: `cron(0 12 * * ? *)` (daily at 12:00 UTC)
  * Rate: `rate(1 hour)` (every hour)
* Target: Select the Lambda function to trigger
* Input: `[TODO: Define input payload if needed]`

### Scheduled Tasks Reference

| Task Name | Schedule | Lambda Target | Description |
|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

## Verification

- Rules appear in EventBridge console with status "Enabled"
- Lambda functions are triggered on schedule
- CloudWatch Logs show execution results

## Notes

- All schedule expressions use UTC timezone
- Cron expressions in EventBridge use 6 fields (includes year): `cron(min hour day month weekday year)`
- Consider using Serverless Framework's `schedule` event for deployment-managed schedules
