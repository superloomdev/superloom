# Domain Setup Guide

## Overview

Every project needs a domain name that serves as the foundation for all public-facing services: API endpoints, web applications, media delivery, and email.

## Choosing a Domain

- Purchase from a registrar (Namecheap, GoDaddy, Google Domains, etc.)
- Consider purchasing both `.com` and country-specific TLDs if needed
- Choose a short, memorable name - subdomains will be created for each service

## DNS Foundation

After purchasing, point the domain's nameservers to your DNS provider:

- **AWS Route 53**: Create a hosted zone, then set the provided NS records at your registrar
- **Cloudflare**: Add the domain to Cloudflare, then update nameservers at your registrar
- **Other providers**: Follow their nameserver delegation instructions

## Email Configuration

Set up MX records to receive emails:

- **Direct mail server**: Configure MX records pointing to your mail provider
- **Email forwarding**: Use a service like forwardemail.net for simple forwarding (e.g., `admin@domain.com` → personal email)
- **Transactional email**: Configured separately in the messaging step (SES, SendGrid, etc.)

## Common Subdomain Pattern

A typical Superloom project uses these subdomains:

| Subdomain | Purpose |
|---|---|
| `api.domain.com` | API endpoints (API Gateway) |
| `media.domain.com` | Processed images and files (CDN) |
| `static.domain.com` | Static assets (CDN) |
| `[app].domain.com` | Web applications (CDN + S3) |

## Verification

- `dig NS domain.com` - confirms nameserver delegation
- `dig MX domain.com` - confirms email routing
- Allow up to 48 hours for nameserver propagation

## Security Notes

- Enable registrar lock to prevent unauthorized transfers
- Use WHOIS privacy protection
- Store registrar credentials securely
