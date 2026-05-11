# Domain Setup

## Prerequisites

None.

## Steps

### Create a Hosted Zone in Route 53

* AWS Console → Route 53 → Hosted zones → Create hosted zone
* Domain name: `superloom.dev`
* Type: Public hosted zone

Route 53 assigns 4 nameserver (NS) records. Copy all four.

### Point Nameservers to Route 53

* Log in to the domain registrar control panel for `superloom.dev`
* Set nameserver type to **Custom DNS**
* Enter the 4 NS values from Route 53

