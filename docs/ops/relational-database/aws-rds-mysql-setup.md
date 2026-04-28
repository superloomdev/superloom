# AWS RDS MySQL Setup Guide

## Overview

Amazon RDS provides managed MySQL (or Aurora MySQL) instances. For Superloom projects, RDS is used when a relational database is needed alongside or instead of DynamoDB.

## Instance Configuration

Key decisions when creating an RDS instance:

| Setting | Sandbox | Production |
|---|---|---|
| Engine | MySQL 8.0+ or Aurora MySQL | Aurora MySQL (recommended) |
| Template | Free Tier or Dev/Test | Production |
| Instance Class | `db.t3.micro` or `db.t4g.micro` | Based on workload |
| Storage | 20 GB General Purpose SSD | Auto-scaling, General Purpose |
| Multi-AZ | No | Yes |
| Public Access | Yes (if Lambda outside VPC) | Depends on architecture |

## Database User Strategy

Create separate database users for different access levels:

| User | Privileges | Used By |
|---|---|---|
| Admin (master) | Full control | Database administration |
| Application user | SELECT, INSERT, UPDATE, DELETE | Lambda functions |
| Read-only user | SELECT only | Reporting, monitoring |

## Read Replicas

For production, create a read replica to distribute read traffic:

- Reader endpoint is used for read-heavy queries
- Writer endpoint for all write operations
- Both endpoints stored in SSM Parameter Store

## Connection from Lambda

- Lambda outside VPC: RDS must have public access enabled with security group restrictions
- Lambda inside VPC: RDS can remain private (see networking guide)
- Use connection pooling or short-lived connections (Lambda functions are ephemeral)

## Administration Tools

- MySQL Workbench (GUI)
- DBeaver (cross-database GUI)
- `mysql` CLI

## Security

- Never use the master/admin user in application code
- Enforce SSL connections
- Rotate passwords periodically
- Store all credentials in SSM Parameter Store, actual values in `__dev__/secrets/`
