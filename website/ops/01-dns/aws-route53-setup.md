# AWS Route 53 DNS Setup

## Prerequisites

Domain hosted zone created and nameservers delegated.

## Steps

### Add Alias Records for CloudFront

Complete this step after the CloudFront distribution is created.

* AWS Console → Route 53 → Hosted zones → `superloom.dev` → Create record

| Record name | Type | Routing | Target |
|---|---|---|---|
| (blank — apex) | A | Simple | CloudFront distribution domain (Alias) |
| `www` | A | Simple | CloudFront distribution domain (Alias) |

For each record: enable **Alias**, select **Alias to CloudFront distribution**, choose the distribution from the dropdown.

## Notes

- ACM certificate DNS validation records (CNAME) are added automatically by ACM — no manual action needed here
