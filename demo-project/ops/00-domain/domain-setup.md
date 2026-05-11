# Domain Setup

## Prerequisites

None.

## Steps

### Purchase or Use an Existing Domain

* Purchase a domain from a registrar (e.g., Namecheap, GoDaddy, Google Domains)
* Domain: `[TODO: your-domain.com]`

### Configure DNS

* Point the domain's nameservers to your DNS provider (see `01-dns/`)
* Set up MX records for email delivery
  * Option A: Direct mail server configuration
  * Option B: Use a forwarding service (e.g., forwardemail.net) for email forwarding
* Set up remaining DNS records as needed by different services

## Notes

- DNS propagation can take up to 48 hours after nameserver changes
