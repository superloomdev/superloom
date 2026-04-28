# Serverless Custom Domains Setup

> Reference: docs/ops/deployment/serverless-custom-domains-setup.md

## Prerequisites

- Completed: `11-ssl-certificates/`, `15-deployment/serverless-setup.md`

## Steps

### Create API Gateway Custom Domain

Set custom domains to mask AWS-generated API endpoints.

#### API Service Domain

* API Gateway → Custom Domain Names → Create
* Domain Name: `api.[TODO: your-domain.com]`
* Endpoint Configuration: Regional
* ACM Certificate: Select the certificate from the primary region (see `11-ssl-certificates/`)

Note: AWS may take a few minutes to set up the custom domain.

* Note the **Target Domain Name** - this is needed for DNS (see `13-dns/`)

#### Add API Mappings

Map each entity to a path on the custom domain:

| Path | API (Destination) | Stage |
|---|---|---|
| `[TODO: entity-name]` | `[TODO: stage]-[Project]-Server-[Entity]` | `$default` |

Example:
| Path | API (Destination) | Stage |
|---|---|---|
| `api-user` | `prod-MyApp-Server-User` | `$default` |
| `api-order` | `prod-MyApp-Server-Order` | `$default` |

### Create Additional Custom Domains (If Needed)

For webhook endpoints, URL shortener, or other services:

* Domain Name: `[TODO: subdomain].[TODO: your-domain.com]`
* Follow the same pattern as above

## Verification

- Custom domain shows "Available" status in API Gateway
- API is accessible via `https://api.[TODO: domain]/[path]`
- DNS records are configured (see `13-dns/`)

## Notes

- Each entity gets its own path mapping on the custom domain
- Custom domain setup must be done after the first deployment of each entity
- The Target Domain Name from API Gateway must be added as an A record alias in Route 53
