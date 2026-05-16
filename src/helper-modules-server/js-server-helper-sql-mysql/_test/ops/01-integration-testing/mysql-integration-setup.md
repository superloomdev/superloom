# MySQL Integration Testing Setup

Run the module tests against a real MySQL-compatible database (MySQL 8+, MariaDB, or any compatible managed service).

## 1. Provision a Database

Use any MySQL 8+ compatible database - self-hosted, managed cloud service, or otherwise. Ensure:

1. TCP port `3306` is reachable from your test runner IP.
2. A database named `test_db` exists (or adjust `MYSQL_DATABASE` to match your setup).
3. A dedicated test user with full privileges on `test_db` is created.

```sql
CREATE DATABASE test_db CHARACTER SET utf8mb4;

CREATE USER 'unit_tester'@'%' IDENTIFIED BY '[SECRET → __dev__/secrets/sandbox.md]';
GRANT ALL PRIVILEGES ON test_db.* TO 'unit_tester'@'%';
FLUSH PRIVILEGES;
```

## 2. Configure `__dev__/.env.integration`

Fill in the real credentials (see `__dev__/secrets/sandbox.md`):

```
MYSQL_HOST=your-db-host
MYSQL_PORT=3306
MYSQL_DATABASE=test_db
MYSQL_USER=unit_tester
MYSQL_PASSWORD=your-password
MYSQL_ROOT_PASSWORD=your-master-user-password
```

Then load into your shell:

```bash
source init-env.sh   # select 'integration'
```

## 3. Run Tests

```bash
cd src/helper-modules-server/js-server-helper-sql-mysql/_test
npm install
npm test
```

## 4. Cleanup

Tests auto-drop their `test_table`. Nothing else is created.

## Notes

- SSL: Many managed databases enforce TLS. Set `SSL: true` in the module config if required.
- `MYSQL_ROOT_PASSWORD` is used by the test's admin connection for table setup/teardown - it must have DDL privileges on `test_db`.
