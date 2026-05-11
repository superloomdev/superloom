# AWS Route 53 DNS Guide

## Overview

Route 53 is AWS's DNS service. It translates domain names to the IP addresses of your services (API Gateway, CloudFront, S3, etc.).

## Hosted Zone

A hosted zone contains the DNS records for a domain:

- Create one hosted zone per domain
- NS (nameserver) and SOA records are created automatically
- Set the provided nameservers at your domain registrar

## Record Types

| Type | Purpose | Example |
|---|---|---|
| A (Alias) | Points subdomain to AWS service | `api.domain.com` → API Gateway |
| CNAME | Points subdomain to another domain | `mail.domain.com` → mail provider |
| MX | Mail routing | Email server addresses |
| TXT | Verification, SPF, DKIM | Domain ownership, email auth |

## Alias Records

Route 53 Alias records are special - they point directly to AWS resources without CNAME overhead:

- API Gateway Custom Domain → A record (Alias)
- CloudFront Distribution → A record (Alias)
- S3 Website Endpoint → A record (Alias)
- Load Balancer → A record (Alias)

## Common DNS Layout

| Subdomain | Points To | Record Type |
|---|---|---|
| `api` | API Gateway Custom Domain | A (Alias) |
| `media` | CloudFront Distribution (media bucket) | A (Alias) |
| `static` | CloudFront Distribution (static bucket) | A (Alias) |
| `[app-name]` | CloudFront Distribution (app bucket) | A (Alias) |

## TTL (Time to Live)

- Default: 300 seconds (5 minutes) for Alias records
- Higher TTL (3600+) for stable records to reduce DNS lookups
- Lower TTL (60-300) when you expect to change records soon

## Alternatives

| Service | When to Use |
|---|---|
| Cloudflare DNS | Cloud-agnostic, includes CDN and DDoS protection |
| Google Cloud DNS | GCP-focused projects |
| Route 53 | AWS-native, best integration with AWS services |
