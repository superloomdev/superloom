# AWS EventBridge Scheduled Tasks Guide

## Overview

Amazon EventBridge (formerly CloudWatch Events) enables scheduled execution of Lambda functions. Use it for cron jobs, periodic data processing, cleanup tasks, and scheduled reports.

## Schedule Expressions

EventBridge supports two formats:

### Rate Expression

```
rate(1 hour)
rate(5 minutes)
rate(1 day)
```

### Cron Expression

EventBridge cron uses 6 fields (includes year):

```
cron(minutes hours day-of-month month day-of-week year)
```

Examples:
- Daily at midnight UTC: `cron(0 0 * * ? *)`
- Every weekday at 9 AM UTC: `cron(0 9 ? * MON-FRI *)`
- First of every month: `cron(0 0 1 * ? *)`
- Every 15 minutes: `rate(15 minutes)`

All times are in UTC.

## Serverless Framework Integration

Scheduled events can be defined directly in `serverless.yml`:

```yaml
functions:
  cleanupExpiredSessions:
    handler: handler.cleanup
    events:
      - schedule:
          rate: rate(1 day)
          enabled: true
          input:
            task: cleanup_sessions
```

This is the recommended approach - the schedule is deployed and managed alongside the Lambda function.

## Alternatives

| Service | When to Use |
|---|---|
| EventBridge | AWS-native, deep Lambda integration |
| CloudWatch Events | Legacy name, same service as EventBridge |
| GCP Cloud Scheduler | Google Cloud equivalent |
| cron (on EC2/ECS) | Traditional server-based scheduling |
