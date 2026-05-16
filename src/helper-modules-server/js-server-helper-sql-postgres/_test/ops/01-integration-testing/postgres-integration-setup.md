# PostgreSQL Integration Testing Setup

Run the module tests against a real PostgreSQL-compatible database (Postgres 15+, or any compatible managed service).

## 1. Provision a Database

Use any Postgres 15+ compatible database - self-hosted, managed cloud service, or otherwise. Ensure:

1. TCP port `5432` is reachable from your test runner IP.
2. A database named `test_db` exists (or adjust `POSTGRES_DATABASE` to match your setup).
3. A dedicated test user with full privileges on `test_db` is created.

```sql
CREATE DATABASE test_db;

CREATE USER unit_tester WITH PASSWORD '[SECRET → __dev__/secrets/sandbox.md]';
GRANT ALL PRIVILEGES ON DATABASE test_db TO unit_tester;

\c test_db
GRANT ALL ON SCHEMA public TO unit_tester;
```

## 2. Configure `__dev__/.env.integration`

Fill in the real credentials (see `__dev__/secrets/sandbox.md`):

```
POSTGRES_HOST=your-db-host
POSTGRES_PORT=5432
POSTGRES_DATABASE=test_db
POSTGRES_USER=unit_tester
POSTGRES_PASSWORD=your-password
```

Then load into your shell:

```bash
source init-env.sh   # select 'integration'
```

## 3. Run Tests

```bash
cd src/helper-modules-server/js-server-helper-sql-postgres/_test
npm install
npm test
```

## 4. Cleanup

Tests auto-drop their `test_table`. Nothing else is created.

## Notes

- SSL: Many managed databases enforce TLS. Set `SSL: true` in the module config if required.
