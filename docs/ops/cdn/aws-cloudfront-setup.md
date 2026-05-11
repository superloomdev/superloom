# AWS CloudFront CDN Guide

## Overview

CloudFront is a content delivery network that caches and serves content from edge locations close to users. Use it for serving media files, static assets, and web applications with HTTPS and low latency.

## When to Use CloudFront

| Content Type | Origin | CloudFront? |
|---|---|---|
| Processed media (images, files) | S3 public bucket | Yes |
| Static assets (JSON, config) | S3 public bucket | Yes |
| Web applications (SPA) | S3 static hosting | Yes |
| API endpoints | API Gateway | Usually no (API Gateway handles its own edge) |

## Response Header Policies

Create reusable response header policies before creating distributions:

### No-Cache Policy

For dynamic content that must not be cached in the browser:

- Name: `no-caching-in-browser`
- Custom Header: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- Origin Override: Yes

### CORS Policy

For content served to web applications from different origins:

- Name: `simple-cors-with-origin-override`
- CORS: Enabled
- Allow Origin: All origins (or restrict to known domains)
- Allow Methods: OPTIONS, GET, HEAD
- Origin Override: Yes

## Distribution Configuration

For each distribution:

| Setting | Value |
|---|---|
| Origin | S3 website endpoint (not the bucket ARN) |
| Viewer Protocol Policy | Redirect HTTP to HTTPS |
| Alternate Domain Name | Your subdomain (e.g., `media.domain.com`) |
| SSL Certificate | US East ACM certificate |
| Default Root Object | `index.html` (for web apps) |

### SPA Routing

For single-page applications, configure custom error responses:
- Error Code 404 → Response Page `/index.html` → Response Code 200

This routes all paths to the SPA router.

## Cache Management

- Use cache invalidation (`/*`) after deploying new content
- Set appropriate `Cache-Control` headers at the S3 origin for static assets
- CloudFront distributions take 15-30 minutes to deploy or update

## Alternatives

| Service | When to Use |
|---|---|
| Cloudflare | Cloud-agnostic, includes DNS and DDoS protection |
| Fastly | Advanced edge computing needs |
| AWS CloudFront | Deep AWS integration, same-account billing |
