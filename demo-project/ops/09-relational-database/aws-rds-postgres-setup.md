# AWS RDS Postgres Setup

> Reference: docs/ops/relational-database/aws-rds-postgres-setup.md

## Prerequisites

- Completed: `05-identity-access/`, `06-networking/`

## Steps

### Create RDS Instance

* RDS → Create Database
* Engine: PostgreSQL (or Aurora PostgreSQL)
* Version: `[TODO: e.g., 16]`
* Template: `[TODO: Free Tier / Production]`
* DB Instance Identifier: `[TODO: project-stage-db]`
* Master Username: `[TODO: admin_user]`
* Master Password: `[SECRET → __dev__/secrets/sandbox.md]`
* Instance Class: `[TODO: e.g., db.t3.micro]`
* Storage: `[TODO: e.g., 20 GB, General Purpose SSD]`
* Multi-AZ: `[TODO: No for sandbox, Yes for production]`
* VPC: `[TODO: Select or use default]`
* Public Access: `[TODO: Yes if Lambda is outside VPC, No if inside VPC]`
* Database Name: `[TODO: e.g., app_project]`
* Region: `[TODO: e.g., ap-south-1]`

### Create Application Database User

Connect to the database and create a limited-privilege user:

```sql
CREATE USER [TODO: server_user] WITH PASSWORD '[SECRET]';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO [TODO: server_user];
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO [TODO: server_user];
```

### Create Read Replica (Production Only)

* RDS → Select primary instance → Actions → Create Read Replica
* Instance Identifier: `[TODO: project-prod-db-reader]`
* Instance Class: `[TODO: Same as primary or smaller]`

## Verification

- Connect using `psql` or a GUI tool (DBeaver, pgAdmin)
- Application user can perform CRUD operations
- Read replica is syncing (production only)

## Notes

- Writer endpoint: `[TODO: recorded in SSM as CFG_DB_HOST]`
- Reader endpoint: `[TODO: recorded in SSM as CFG_DB_HOST_READER]`
- All credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
