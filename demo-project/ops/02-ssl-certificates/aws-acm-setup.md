# AWS ACM SSL Certificate Setup

## Prerequisites

Domain registered and AWS account active.

## Steps

### Request Certificate in Primary Region

* AWS Console → Certificate Manager → Request Certificate
* Region: `[TODO: e.g., ap-south-1 (Mumbai)]`
* Request a public certificate
* Domain: `*.[TODO: your-domain.com]`
* Additional Domains: `[TODO: your-domain.com]`
* Validation Method: DNS validation (recommended) or Email validation

### Request Certificate in US East (Required)

API Gateway Custom Domains and CloudFront Distributions only support certificates in `us-east-1`.

* AWS Console → Certificate Manager → Request Certificate
* Region: **US East (N. Virginia) - us-east-1**
* Request a public certificate
* Domain: `*.[TODO: your-domain.com]`
* Additional Domains: `[TODO: your-domain.com]`
* Validation Method: DNS validation (recommended)

### Validate Certificates

* For DNS validation: Add the CNAME records provided by ACM to Route 53 (see `01-dns/`)
* For Email validation: Approve via the admin email for the domain
* Wait for certificate status to change to "Issued"

## Notes

- ACM certificates are free for use with AWS services
- Certificates auto-renew if DNS validation records remain in place
- CloudFront and API Gateway Custom Domains require the certificate to be in `us-east-1`
