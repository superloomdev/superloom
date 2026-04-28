# AWS DynamoDB Setup

> Reference: docs/ops/nosql-database/aws-dynamodb-setup.md

## Prerequisites

- Completed: `05-identity-access/`

## Steps

### Configure DynamoDB

* Region: `[TODO: e.g., ap-south-1]`
* DynamoDB is fully managed - no instance provisioning required

### Create Tables

Tables are defined in the project's database schema file (NDB file). Create each table as specified:

* DynamoDB → Create Table
* Table Name: `[TODO: as per schema]`
* Partition Key: `[TODO: as per schema]`
* Sort Key: `[TODO: as per schema, if applicable]`
* Capacity Mode: On-Demand (recommended for variable workloads)

### Test Tables (Sandbox Only)

For unit testing, create tables prefixed with `test_`:

* Table Name: `test_[TODO: table-name]`
* Same schema as production tables
* These tables are accessible by the `unit-tester` IAM user (see `05-identity-access/`)

## Verification

- Tables are visible in DynamoDB Console
- Application IAM user can perform CRUD operations on project tables
- Unit tester IAM user can only access `test_` prefixed tables

## Notes

- DynamoDB is a fully managed service - no maintenance or scaling configuration needed for on-demand mode
- For provisioned capacity mode, set read/write capacity units based on expected traffic
- Table schemas should be documented in the project's database definition files
