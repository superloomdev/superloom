# AWS ACM SSL Certificate Guide

## Overview

AWS Certificate Manager (ACM) provides free SSL/TLS certificates for use with AWS services. Every public-facing service (API, web app, CDN) needs HTTPS, which requires an SSL certificate.

## Key Requirement: Multi-Region Certificates

AWS services have specific region requirements for certificates:

| AWS Service | Required Certificate Region |
|---|---|
| API Gateway (Regional) | Same region as the API |
| CloudFront | **US East (us-east-1) only** |
| API Gateway Custom Domain | **US East (us-east-1) only** |

You typically need the **same certificate in two regions**: your primary region and `us-east-1`.

## Certificate Types

- **Wildcard**: `*.domain.com` - covers all subdomains (recommended)
- **Single domain**: `domain.com` - covers only the apex domain
- **Multi-domain**: List specific domains/subdomains

Request both `*.domain.com` and `domain.com` in a single certificate to cover all cases.

## Validation Methods

| Method | Process | Best For |
|---|---|---|
| DNS | Add CNAME record to DNS | Automated, recommended |
| Email | Approve via admin email | When DNS is not yet configured |

DNS validation is recommended because:
- Certificates auto-renew as long as the DNS record exists
- No manual intervention needed after initial setup

## Process

1. Request certificate in your primary region
2. Request the same certificate in `us-east-1`
3. Add DNS validation CNAME records to your DNS provider
4. Wait for status to change to "Issued" (usually minutes with DNS)
5. Reference certificates in CloudFront and API Gateway configurations

## Security

- ACM certificates are free and auto-renew
- Private keys are managed by AWS and never exposed
- Certificates are only usable with AWS services (not downloadable)
