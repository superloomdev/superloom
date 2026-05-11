# AWS RDS Postgres Setup Guide

## Overview

Amazon RDS provides managed PostgreSQL (or Aurora PostgreSQL) instances. PostgreSQL is an alternative to MySQL for projects requiring advanced SQL features, JSON support, or PostGIS.

## Instance Configuration

| Setting | Sandbox | Production |
|---|---|---|
| Engine | PostgreSQL 16+ or Aurora PostgreSQL | Aurora PostgreSQL (recommended) |
| Template | Free Tier or Dev/Test | Production |
| Instance Class | `db.t3.micro` or `db.t4g.micro` | Based on workload |
| Storage | 20 GB General Purpose SSD | Auto-scaling |
| Multi-AZ | No | Yes |
| Public Access | Yes (if Lambda outside VPC) | Depends on architecture |

## Database User Strategy

| User | Privileges | Used By |
|---|---|---|
| Admin (master) | Full control | Database administration |
| Application user | SELECT, INSERT, UPDATE, DELETE on application schema | Lambda functions |
| Read-only user | SELECT only | Reporting, monitoring |

## Local Development

The framework's Docker Compose provides a local Postgres instance:

```bash
docker compose -f docs/dev/docker-compose.yml up postgres -d
```

Default local credentials:
- Host: `localhost:5432`
- Database: `app_dev`
- User: `dev_user`
- Password: `dev_password`

## Administration Tools

- pgAdmin (GUI)
- DBeaver (cross-database GUI)
- `psql` CLI

## Security

- Create dedicated application users with minimal privileges
- Enforce SSL connections in production
- Store all credentials in SSM Parameter Store, actual values in `__dev__/secrets/`
