# AWS S3 Setup Guide

## Overview

S3 (Simple Storage Service) provides object storage for files, media, static websites, and deployment artifacts. A typical project uses multiple buckets with different access levels.

## Common Bucket Types

| Bucket Purpose | Access | Static Hosting | Lifecycle |
|---|---|---|---|
| Source code (Lambda deployment) | Private | No | None |
| Raw uploads (unprocessed) | Private | No | None |
| Temporary uploads (signed URL) | Public | No | Auto-expire (2 days) |
| Processed media | Public | Yes | None |
| Static assets (JSON, config) | Public | Yes | None |
| Web app hosting (SPA) | Public | Yes | None |
| Logging | Private | No | Optional expiry |

## Naming Convention

```
[stage]-[project]-[purpose]
```

Examples: `dev-myapp-media`, `prod-myapp-source-code`, `dev-myapp-file-upload`

Bucket names are globally unique across all AWS accounts.

## Bucket Configuration Patterns

### Private Bucket

- ACL: Disabled
- Block all public access: Checked
- No static hosting, no CORS

### Public Media/Static Bucket

- Block public access: Unchecked
- Static Website Hosting: Enabled (index: `index.html`)
- Bucket Policy: Public read access

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject"],
    "Resource": ["arn:aws:s3:::BUCKET-NAME/*"]
  }]
}
```

- CORS: Allow GET/HEAD from all origins (or restrict to known domains)

### Temporary Upload Bucket

- Object Ownership: ACLs enabled, Bucket owner preferred
- Block public access: Unchecked
- Lifecycle Rule: Auto-expire objects after 2 days
- CORS: Allow GET/POST/PUT/HEAD from application domains

### SPA Hosting Bucket

- Static Website Hosting: Enabled
  - Index Document: `index.html`
  - Error Document: `index.html` (routes all 404s to the SPA router)
- CORS: Allow requests from known origins with credentials

## CORS Configuration

Standard CORS for a public read bucket:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedOrigins": ["*"],
  "ExposeHeaders": []
}]
```

Restrictive CORS for an application bucket:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "POST", "HEAD"],
  "AllowedOrigins": ["https://app.domain.com", "http://localhost:3000"],
  "ExposeHeaders": ["Content-Length", "ETag"],
  "MaxAgeSeconds": 3000
}]
```

## Security

- Ensure IAM policies (see identity-access guide) reference the correct bucket ARNs
- Review bucket policies regularly - avoid overly permissive access
- Enable S3 access logging for audit trails on sensitive buckets
