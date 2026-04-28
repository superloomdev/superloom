# AWS Route 53 DNS Setup

> Reference: docs/ops/dns/aws-route53-setup.md

## Prerequisites

- Completed: `00-domain/`, `11-ssl-certificates/`, `12-cdn/`, `15-deployment/`

## Steps

### Create Hosted Zone

* Route 53 → Hosted Zones → Create Hosted Zone
* Domain Name: `[TODO: your-domain.com]`
* Type: Public Hosted Zone
* NS and SOA records are automatically created by AWS
* Set these nameservers at your domain registrar

### Create DNS Records

Create A records (Alias) for each service:

#### API Endpoint

* Name: `api`
* Type: A - IPv4 address
* Alias: Yes
* Value: `[TODO: Target domain from API Gateway Custom Domain]`

#### Web Application

* Name: `[TODO: app-subdomain]`
* Type: A - IPv4 address
* Alias: Yes
* Value: `[TODO: Target domain from CloudFront Distribution]`

#### Media Files

* Name: `media`
* Type: A - IPv4 address
* Alias: Yes
* Value: `[TODO: Target domain from CloudFront Distribution]`

#### Static Files

* Name: `static`
* Type: A - IPv4 address
* Alias: Yes
* Value: `[TODO: Target domain from CloudFront Distribution]`

### Additional Records

Add records as needed for additional services:

| Subdomain | Type | Points To |
|---|---|---|
| `[TODO]` | A (Alias) | `[TODO: CloudFront / API Gateway / Load Balancer]` |

## Verification

- `dig A api.[TODO: domain]` resolves to the correct target
- All subdomains are accessible via HTTPS
- SSL certificates are served correctly

## Notes

- DNS propagation can take up to 48 hours but typically completes within minutes for Route 53
- TTL is set to 300 seconds (5 minutes) by default for alias records
- Keep a record of all DNS entries in this document for reference
