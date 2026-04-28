# AWS CloudFront Setup

> Reference: docs/ops/cdn/aws-cloudfront-setup.md

## Prerequisites

- Completed: `07-object-storage/`, `11-ssl-certificates/`

## Steps

### Create Response Header Policies

#### No-Cache Policy

For content that should never be cached on the client side.

* CloudFront → Policies → Response Headers → Create Response Headers Policy
* Name: `no-caching-in-browser`
* Description: Add extra no-cache headers so browser does not cache
* Configure CORS: Off (default)
* Security headers: All Off (default)
* Custom headers → Add Header:
  * Name: `Cache-Control`
  * Value: `no-store, no-cache, must-revalidate, max-age=0`
  * Origin override: Checked

#### Simple CORS Policy

For content that needs CORS headers with origin override.

* CloudFront → Policies → Response Headers → Create Response Headers Policy
* Name: `simple-cors-with-origin-override`
* Description: Allows all origins for CORS requests with origin override
* Configure CORS: On
  * Access-Control-Allow-Origin: All origins
  * Access-Control-Allow-Headers: All headers
  * Access-Control-Allow-Methods: OPTIONS, GET, HEAD
  * Access-Control-Expose-Headers: All headers
  * Origin override: Checked

### Create Distributions

Create a CloudFront distribution for each public-facing S3 bucket or service.

#### Distribution: Media Files

* CloudFront → Create Distribution
* Origin: `[TODO: stage]-[project]-media.s3-website.[region].amazonaws.com`
* Viewer Protocol Policy: Redirect HTTP to HTTPS
* Alternate Domain Name: `media.[TODO: your-domain.com]`
* SSL Certificate: Select the US East certificate (from `11-ssl-certificates/`)
* Cache Policy: `[TODO: Select appropriate caching policy]`

#### Distribution: Web App

* CloudFront → Create Distribution
* Origin: `[TODO: stage]-[project]-[app].s3-website.[region].amazonaws.com`
* Viewer Protocol Policy: Redirect HTTP to HTTPS
* Alternate Domain Name: `[TODO: app-subdomain].[TODO: your-domain.com]`
* SSL Certificate: Select the US East certificate
* Custom Error Responses: 404 → /index.html, 200 (for SPA routing)

## Verification

- Distributions show status "Deployed"
- Content is accessible via the CloudFront domain
- CORS headers are present in responses
- DNS records point to CloudFront distribution (see `13-dns/`)

## Notes

- CloudFront distributions can take 15-30 minutes to deploy
- Use cache invalidation (`/*`) after deploying new content
- Each distribution's domain name must be added as a DNS CNAME/Alias record
