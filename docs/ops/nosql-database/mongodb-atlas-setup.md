# MongoDB Atlas Setup Guide

## Overview

MongoDB Atlas is a managed MongoDB service. It is an alternative to DynamoDB for projects requiring a document database with rich query capabilities, aggregation pipelines, or when a project needs to remain cloud-agnostic.

## Atlas Project Structure

Atlas uses a hierarchy: Organization → Project → Cluster → Database → Collection.

| Level | Example |
|---|---|
| Project | `myapp sandbox`, `myapp production` |
| Cluster | `Main-NDB-Project` |
| Database | `ndb_project` |
| Collection | `users`, `orders`, etc. |

## Cluster Types

| Type | Best For | Scaling |
|---|---|---|
| Serverless | Variable traffic, no capacity planning | Auto-scales, pay per operation |
| Dedicated | Predictable traffic, specific performance needs | Manual or auto-scaling |
| Shared (Free/M0) | Development and prototyping | Fixed resources |

Serverless is recommended for most Superloom projects.

## Configuration

- Provider: AWS (for co-location with other services)
- Region: Same as your primary AWS region
- Continuous Backup: Enabled (for production data protection)

## Connection

- Authentication: Username/password
- Network Access: Allow access from anywhere (or restrict to known IPs)
- Connection String Format: `mongodb+srv://user:password@cluster-host/?retryWrites=true&w=majority`

## Local Development

The framework's Docker Compose provides a local MongoDB instance:

```bash
docker compose -f docs/dev/docker-compose.yml up mongodb -d
```

Default local connection: `mongodb://localhost:27017/app_dev`

## Security

- Create separate projects for sandbox and production
- Use dedicated database users (not the admin account) for application access
- Enable audit logging for production clusters
- Store all credentials in SSM Parameter Store, actual values in `__dev__/secrets/`
