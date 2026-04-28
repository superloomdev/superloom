# Postgres Local Setup (Emulated Testing)

Run the module tests against a local Postgres 17 container.

## 1. Start Docker

```bash
cd src/helper-modules-server/js-server-helper-postgres/_test
docker compose up -d
```

The compose file boots `postgres:17-alpine` on port `5432` with:
- Database: `test_db`
- User: `test_user` (password: `test_pw`) - superuser on `test_db`

Wait until the healthcheck reports healthy:

```bash
docker compose ps
```

## 2. Configure `__dev__/.env.dev`

Ensure these variables are present in `__dev__/.env.dev` (copy from `docs/dev/.env.dev.example` if setting up for the first time):

```
# --- Postgres module tests (_test/docker-compose.yml) ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=test_db
POSTGRES_USER=test_user
POSTGRES_PASSWORD=test_pw
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
