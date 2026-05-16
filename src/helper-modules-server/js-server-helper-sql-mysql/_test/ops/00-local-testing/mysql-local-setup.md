# MySQL Local Setup (Emulated Testing)

Run the module tests against a local MySQL 8 container.

## 1. Start Docker

```bash
cd src/helper-modules-server/js-server-helper-sql-mysql/_test
docker compose up -d
```

The compose file boots `mysql:8.0` on port `3306` with:
- Root password: `test_root_pw`
- Database: `test_db`
- User: `test_user` (password: `test_pw`) - granted all privileges on `test_db`

Wait until the healthcheck reports healthy:

```bash
docker compose ps
```

## 2. Configure `__dev__/.env.dev`

Ensure these variables are present in `__dev__/.env.dev` (copy from `docs/dev/.env.dev.example` if setting up for the first time):

```
# --- MySQL module tests (_test/docker-compose.yml) ---
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=test_db
MYSQL_USER=test_user
MYSQL_PASSWORD=test_pw
MYSQL_ROOT_PASSWORD=test_root_pw
```

These values match the credentials hardcoded in `_test/docker-compose.yml`. Then load into your shell:

```bash
source init-env.sh   # select 'dev'
```

## 3. Install and Run Tests

```bash
npm install
npm test
```

## 4. Teardown

```bash
docker compose down
```
