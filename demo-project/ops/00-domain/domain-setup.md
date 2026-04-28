# Domain Setup

> Reference: docs/ops/domain/domain-setup.md

## Prerequisites

- None - this is the first step

## Steps

### Purchase or Use an Existing Domain

* Purchase a domain from a registrar (e.g., Namecheap, GoDaddy, Google Domains)
* Domain: `[TODO: your-domain.com]`

### Configure DNS

* Point the domain's nameservers to your DNS provider (see `13-dns/` for DNS setup)
* Set up MX records for email delivery
  * Option A: Direct mail server configuration
  * Option B: Use a forwarding service (e.g., forwardemail.net) for email forwarding
* Set up remaining DNS records as needed by different services

## Verification

- Confirm nameserver propagation: `dig NS your-domain.com`
- Confirm MX records: `dig MX your-domain.com`

## Notes

- DNS propagation can take up to 48 hours after nameserver changes
- Keep domain registrar credentials in `__dev__/secrets/`
