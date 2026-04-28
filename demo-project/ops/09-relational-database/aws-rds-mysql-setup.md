# AWS RDS MySQL Setup

> Reference: docs/ops/relational-database/aws-rds-mysql-setup.md

## Prerequisites

- Completed: `05-identity-access/`, `06-networking/`

## Steps

### Create RDS Instance

* RDS → Create Database
* Engine: MySQL (or Aurora MySQL)
* Version: `[TODO: e.g., 8.0]`
* Template: `[TODO: Free Tier / Production]`
* DB Instance Identifier: `[TODO: project-stage-db]`
* Master Username: `[TODO: admin_user]`
* Master Password: `[SECRET → __dev__/secrets/sandbox.md]`
* Instance Class: `[TODO: e.g., db.t3.micro]`
* Storage: `[TODO: e.g., 20 GB, General Purpose SSD]`
* Multi-AZ: `[TODO: No for sandbox, Yes for production]`
* VPC: `[TODO: Select or use default]`
* Public Access: `[TODO: Yes if Lambda is outside VPC, No if inside VPC]`
* Database Name: `[TODO: e.g., db_project]`
* Region: `[TODO: e.g., ap-south-1]`

### Create Application Database User

Connect to the database and create a limited-privilege user for the application:

```sql
CREATE USER '[TODO: server_user]'@'%' IDENTIFIED BY '[SECRET]';
GRANT SELECT, INSERT, UPDATE, DELETE ON [TODO: db_name].* TO '[TODO: server_user]'@'%';
FLUSH PRIVILEGES;
```

### Create Read Replica (Production Only)

* RDS → Select primary instance → Actions → Create Read Replica
* Instance Identifier: `[TODO: project-prod-db-reader]`
* Instance Class: `[TODO: Same as primary or smaller]`

## Verification

- Connect to the database using admin tools (e.g., MySQL Workbench, DBeaver)
- Application user can perform CRUD operations
- Read replica is syncing (production only)

## Notes

- Writer endpoint: `[TODO: recorded in SSM as CFG_DB_HOST]`
- Reader endpoint: `[TODO: recorded in SSM as CFG_DB_HOST_READER]`
- Database admin tools reference: MySQL Workbench, DBeaver, or CLI
- All credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
