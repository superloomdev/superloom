# AWS CloudFront Setup

## Prerequisites

ACM certificate issued in us-east-1. S3 bucket created.

## Steps

### Create a Distribution

* AWS Console → CloudFront → Distributions → Create distribution
* Plan: Pay-as-you-go

#### Get started

| Field | Value |
|---|---|
| Name | `Superloom Website` |
| Description | `Superloom Website` |
| Distribution type | Single website or app |
| Route 53 managed domain | `superloom.dev` |

#### Specify origin

| Field | Value |
|---|---|
| Origin type | Amazon S3 |
| S3 origin | `superloom-website.s3.us-east-1.amazonaws.com` |
| Origin path | (blank) |
| Allow private S3 bucket access to CloudFront | Enabled |
| Origin settings | Use recommended origin settings |
| Cache settings | Use recommended cache settings tailored to serving S3 content |

#### Enable security (WAF)

| Field | Value |
|---|---|
| Web Application Firewall | **Do not enable security protections** |

> WAF is disabled — it adds a fixed ~$14/month cost regardless of traffic. This is a public static documentation site with no user input or authentication, so WAF provides no benefit. Re-evaluate if the site ever serves authenticated or dynamic content.

#### Get TLS certificate

| Field | Value |
|---|---|
| Certificate | `superloom.dev (655a8721-a54b-448a-b564-6edd91d9fb9b)` |

### Configure SPA Routing

* CloudFront → Distribution → Error pages → Create custom error response
* HTTP error code: `403` → Response page: `/index.html` → Response code: `200`
* Repeat for `404`

### Note the Distribution Domain Name

Once deployed, copy the CloudFront distribution domain (e.g. `d1234abcd.cloudfront.net`) — needed for Route 53 alias records.

## Notes

- Distribution ID: `E1ZDM8AXH5GE92`
- Distribution domain: `d2q0w4wwwj24wc.cloudfront.net`
- ARN: `arn:aws:cloudfront::279637172655:distribution/E1ZDM8AXH5GE92`
- Distributions take 15-30 minutes to deploy after creation or configuration changes
- Cache invalidation (`/*`) is required after each deployment — handled by the CI/CD pipeline
