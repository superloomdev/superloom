# AWS SES Email Guide

## Overview

Amazon Simple Email Service (SES) provides transactional email sending. Use it for sending verification emails, notifications, receipts, and other automated communications.

## Setup Process

1. **Verify domain** - Prove ownership via DNS records (DKIM, verification TXT)
2. **Request production access** - SES starts in sandbox mode (limited to verified addresses)
3. **Configure sending** - Set up sender addresses and bounce/complaint handling

## Sandbox vs Production

| Feature | Sandbox | Production |
|---|---|---|
| Recipients | Verified addresses only | Any address |
| Sending rate | 1 email/second | Based on account reputation |
| Daily limit | 200 emails | Based on account reputation |
| Request required | No | Yes (24-48 hour review) |

## Email Types

| Type | Example | Best Practice |
|---|---|---|
| Transactional | Verification codes, password resets | Send immediately, no unsubscribe needed |
| Notification | Order confirmations, status updates | Include unsubscribe link |
| Marketing | Newsletters, promotions | Dedicated sending domain, unsubscribe required |

## Bounce and Complaint Handling

- Configure SNS topics for bounce and complaint notifications
- Monitor bounce rate (keep below 5%) and complaint rate (keep below 0.1%)
- Remove bounced addresses from sending lists

## Alternatives

| Service | When to Use |
|---|---|
| SendGrid | Cloud-agnostic, advanced templates |
| Mailgun | Developer-friendly API, good deliverability |
| AWS SES | Low cost, deep AWS integration |

## Push Notifications and SMS

For push notifications and SMS, use AWS SNS (Simple Notification Service):
- Push: SNS → Platform applications (APNS for iOS, FCM for Android)
- SMS: SNS → SMS messaging (direct or via topics)
