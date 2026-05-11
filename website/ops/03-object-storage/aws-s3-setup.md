# AWS S3 Setup

## Prerequisites

AWS account active.

## Steps

### Create the Website Bucket

* AWS Console → S3 → Create bucket → Region: **us-east-1**

| Field | Value |
|---|---|
| Bucket name | `superloom-website` |
| Region | `us-east-1` |
| ACLs | Disabled |
| Block all public access | Enabled |
| Bucket versioning | Disabled |
| Encryption | SSE-S3, default |

## Notes

- Bucket is intentionally private — all traffic goes through CloudFront via Origin Access Control (OAC). CloudFront updates the bucket policy automatically when the distribution is created.
- Do not enable static website hosting on the bucket — CloudFront handles routing.
