# MongoDB Atlas Setup

> Reference: docs/ops/nosql-database/mongodb-atlas-setup.md

## Prerequisites

- Completed: `01-cloud-provider/`

## Steps

### Create Atlas Project

* MongoDB Atlas → Projects → New Project
* Project Name: `[TODO: project-name] [stage]` (e.g., `myapp sandbox`)

### Create Database Deployment

* Create a new database in the project
* Type: Serverless (recommended) or Dedicated
* Provider: AWS
* Region: `[TODO: e.g., ap-south-1 (Mumbai)]`
* Name: `[TODO: e.g., Main-NDB-Project]`
* Serverless Continuous Backup: Checked

### Create Database

* Select the deployment → Collections → Create Database
* Database Name: `[TODO: e.g., ndb_project]`
* Initial Collection Name: `[TODO: e.g., test_table]`

### Configure Connection

* Select deployment → Connect → Standard Connection
* Connection IP Address: Allow access from anywhere (or restrict to specific IPs)
* Database Username: `[TODO: e.g., root_project]`
* Database Password: `[SECRET → __dev__/secrets/sandbox.md]`

### Connection String

```
mongodb+srv://[TODO: username]:<password>@[TODO: cluster-host]/?retryWrites=true&w=majority
```

Host endpoint: `[TODO: recorded in SSM as CFG_MONGO_DB_HOST]`

## Verification

- Connect using MongoDB Compass or `mongosh` with the connection string
- Application user can perform CRUD operations on the database

## Notes

- Atlas manages scaling, backups, and monitoring automatically
- Maintain separate projects for sandbox and production
- All credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
