# AWS ACM SSL Certificate Setup

## Prerequisites

DNS hosted zone active and nameservers propagated (required for ACM DNS validation).

## Steps

### Request a Public Certificate

* AWS Console → Certificate Manager
* **Region: US East (N. Virginia) — us-east-1** — CloudFront only accepts certificates from this region
* Click Request → Request a public certificate

### Add Domain Names

| Domain |
|---|
| `superloom.dev` |
| `*.superloom.dev` |

### Configure Certificate Settings

| Field | Value |
|---|---|
| Validation method | DNS validation |
| Key algorithm | RSA 2048 |
| Allow export | Disabled |

### Validate via Route 53

After submitting, ACM shows a **"Create DNS records in Amazon Route 53"** button.

* Select both domains and click **Create records**

ACM creates the CNAME validation records automatically. Validation completes within minutes.

## Notes

- Certificate ID: `655a8721-a54b-448a-b564-6edd91d9fb9b`
- ARN: `arn:aws:acm:us-east-1:279637172655:certificate/655a8721-a54b-448a-b564-6edd91d9fb9b`
- Auto-renews as long as the DNS CNAME validation records remain in Route 53
