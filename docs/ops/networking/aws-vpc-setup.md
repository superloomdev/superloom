# AWS VPC and Networking Guide

## Overview

For serverless (Lambda-based) projects, networking configuration determines how Lambda functions access databases and external services.

## Lambda Networking: Two Approaches

### Option A: Lambda Outside VPC (Recommended)

Lambda functions run outside any VPC - no networking constraints.

**Advantages:**
- Simpler configuration
- No NAT Gateway costs
- Direct internet access for external API calls
- Faster cold starts

**Trade-offs:**
- Cannot access VPC-only resources (e.g., RDS in a private subnet)
- RDS must enable public access with strong security group rules

**Best for:** Most serverless projects, especially those using DynamoDB (which is inherently public-endpoint).

### Option B: Lambda Inside VPC

Lambda functions run inside a VPC - can access private resources.

**Advantages:**
- Can access private RDS instances
- Network-level isolation

**Trade-offs:**
- Requires NAT Gateway or NAT Instance for internet access ($45+/month per AZ)
- Lambda needs adequate IP addresses in subnets (can fail to scale if insufficient)
- Use at least one subnet per Availability Zone
- Lambda execution role needs ENI permissions: `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, `ec2:DeleteNetworkInterface`
- Slower cold starts due to ENI attachment

**Best for:** Projects requiring private RDS access or strict network isolation.

## Security Groups

If using VPC, security groups act as virtual firewalls:

- Create separate security groups for each service type
- Inbound rules: Allow only required ports from known sources
- Outbound rules: Allow all outbound by default (restrict if needed)

## Recommendation

For Superloom projects, **Option A (Lambda outside VPC)** is recommended unless you have a specific requirement for VPC-only resources. If RDS is needed, configure it with public access and restrict via security groups and IAM.
