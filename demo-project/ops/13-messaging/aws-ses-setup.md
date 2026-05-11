# AWS SES Email Setup

## Prerequisites

Domain registered and IAM setup complete.

## Steps

### Verify Domain

* SES → Verified Identities → Create Identity
* Identity Type: Domain
* Domain: `[TODO: your-domain.com]`
* Add the provided DKIM and verification DNS records to Route 53

### Request Production Access

SES starts in sandbox mode (can only send to verified addresses).

* SES → Account Dashboard → Request Production Access
* Provide: Use case description, expected sending volume, bounce/complaint handling plan

### Configure Sending

* Set up a `no-reply@[TODO: your-domain.com]` sender address
* Configure bounce and complaint notifications via SNS topics

## Notes

- SES sandbox mode limits sending to verified email addresses only
- Production access request may take 24-48 hours for approval
- [TODO: Add SNS setup for push notifications if needed]
