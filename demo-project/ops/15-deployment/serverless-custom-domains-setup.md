# Serverless Custom Domains Setup

## Prerequisites

SSL certificate issued in the primary region. At least one Serverless deployment completed.

## Steps

### Create API Gateway Custom Domain

Set custom domains to mask AWS-generated API endpoints.

#### API Service Domain

* API Gateway → Custom Domain Names → Create
* Domain Name: `api.[TODO: your-domain.com]`
* Endpoint Configuration: Regional
* ACM Certificate: Select the certificate from the primary region

Note: AWS may take a few minutes to set up the custom domain.

* Note the **Target Domain Name** — needed for Route 53 DNS alias records

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

## Notes

- Each entity gets its own path mapping on the custom domain
- Custom domain setup must be done after the first deployment of each entity
- The Target Domain Name from API Gateway must be added as an A record alias in Route 53
