# AWS Budget Setup Guide

## Overview

AWS Budgets provides cost tracking and alerts to prevent unexpected charges. Set up budgets immediately after creating an AWS account.

## Creating a Monthly Cost Budget

- AWS Console → Billing → Budgets → Create Budget
- Use the simplified template: **Monthly cost budget**
- Set a reasonable budget amount based on expected usage
- Add email recipients for alert notifications

## Recommended Alert Configuration

After creating the budget, configure two alerts:

| Alert | Threshold | Type |
|---|---|---|
| Warning | 80% of budgeted amount | Actual cost |
| Critical | 100% of budgeted amount | Actual cost |

Delete any automatically created alerts beyond these two.

## Cost Monitoring Tips

- Review the budget dashboard monthly
- Use AWS Cost Explorer for detailed breakdowns by service
- Consider per-service budgets for granular tracking in production
- Set up AWS Free Tier usage alerts separately

## Common Cost Drivers

For a typical Superloom serverless project:

| Service | Cost Factor |
|---|---|
| Lambda | Invocation count and duration |
| DynamoDB | Read/write capacity and storage |
| S3 | Storage volume and request count |
| CloudFront | Data transfer and requests |
| RDS | Instance hours and storage |

Most sandbox environments should cost under $30/month with moderate usage.
