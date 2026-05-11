# AWS RDS MySQL Setup

## Prerequisites

IAM setup complete. VPC and security groups configured if Lambda will run inside VPC.

## Steps

### Create RDS Instance

* RDS → Create Database
* Engine: MySQL (or Aurora MySQL)
* Version: `[TODO: e.g., 8.0]`
* Template: `[TODO: Free Tier / Production]`
* DB Instance Identifier: `[TODO: project-stage-db]`
* Master Username: `[TODO: admin_user]`
* Master Password: `[SECRET → __dev__/secrets/production.md]`
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

## Notes

- Writer endpoint: `[TODO: record in SSM as CFG_DB_HOST]`
- Reader endpoint: `[TODO: record in SSM as CFG_DB_HOST_READER]`
- All credentials: `[SECRET → __dev__/secrets/production.md]`
