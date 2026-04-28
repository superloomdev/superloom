# AWS ACM SSL Certificate Setup

> Reference: docs/ops/ssl-certificates/aws-acm-setup.md

## Prerequisites

- Completed: `00-domain/`, `01-cloud-provider/`

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

* For DNS validation: Add the CNAME records provided by ACM to your DNS (see `13-dns/`)
* For Email validation: Approve via the admin email for the domain
* Wait for certificate status to change to "Issued"

## Verification

- Both certificates show status "Issued" in ACM
- Primary region certificate: used for API Gateway (regional)
- US East certificate: used for CloudFront distributions and API Gateway custom domains

## Notes

- ACM certificates are free for use with AWS services
- Wildcard certificates (`*.domain.com`) cover all subdomains
- Certificates auto-renew if DNS validation records remain in place
- The same domain needs certificates in multiple regions due to AWS service requirements
