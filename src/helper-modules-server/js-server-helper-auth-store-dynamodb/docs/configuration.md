# Configuration

The DynamoDB store adapter is configured through the Auth parent's `STORE` and `STORE_CONFIG` keys. The adapter itself is a factory function; the parent calls it once at load time and retains the returned Store interface.

## On This Page

- [Loader Pattern](#loader-pattern)
- [`STORE_CONFIG` Keys](#store_config-keys)
- [IAM Permissions](#iam-permissions)
- [Peer Dependencies](#peer-dependencies)
- [Environment Variables](#environment-variables)
- [Testing Tier](#testing-tier)

## Loader Pattern

```js
Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  ENDPOINT: process.env.DYNAMO_ENDPOINT,  // optional: for local emulator
  REGION:   process.env.AWS_REGION        // required: AWS region
});

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-auth-store-dynamodb'),
  STORE_CONFIG: { table_name: 'sessions_user', lib_dynamodb: Lib.DynamoDB },
  ACTOR_TYPE:   'user',
  TTL_SECONDS:  2592000
});
```

The adapter is passed to the parent as a **factory function reference**, not as the result of a call. The parent invokes the factory internally with the right arguments (`Lib`, the full `CONFIG`, and the frozen `ERRORS` catalog). Treat `STORE` as a function value; do not call it yourself.

The AWS SDK client is **not** created at loader time. `Lib.DynamoDB` lazy-initializes on the first operation. The adapter does not open any connection during construction either.

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|---|---|---|---|
| `table_name` | String | Yes | Name of the DynamoDB table. Must match the table name provisioned out-of-band |
| `lib_dynamodb` | Object | Yes | Initialized `Lib.DynamoDB` instance. The adapter delegates all AWS SDK calls to this helper |

The validator throws an `Error` at loader time if either key is missing, null, undefined, or (for `table_name`) the empty string. The throw is intentional. Misconfiguration must fail at boot, never silently at first request.

The table must exist before the adapter is used. `setupNewStore` is not implemented for DynamoDB; table provisioning is out-of-band via IaC, AWS Console, or the driver helper's table-management API (if it gains one).

## IAM Permissions

The adapter uses specific DynamoDB actions. The application's IAM policy (or the local emulator's unrestricted policy) must allow these:

| Adapter Method | DynamoDB Action | Resource |
|---|---|---|
| `setupNewStore` | (none — returns NOT_IMPLEMENTED) | — |
| `getSession` | `dynamodb:GetItem` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |
| `listSessionsByActor` | `dynamodb:Query` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |
| `setSession` | `dynamodb:PutItem` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |
| `updateSessionActivity` | `dynamodb:UpdateItem` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |
| `deleteSession` | `dynamodb:DeleteItem` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |
| `deleteSessions` | `dynamodb:BatchWriteItem` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |
| `cleanupExpiredSessions` | `dynamodb:Scan` + `dynamodb:BatchWriteItem` | `arn:aws:dynamodb:<region>:<account>:table/<table_name>` |

### Minimum IAM Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/sessions_user"
    }
  ]
}
```

If you run multiple Auth instances (different `actor_type` values) against different tables, the Resource ARN must cover all of them (wildcard or explicit list).

The adapter does not interact with IAM credential acquisition. The driver helper (`Lib.DynamoDB`) handles the AWS SDK client configuration, including credential chain, region, and endpoint. This adapter simply uses the provided client.

## Peer Dependencies

The adapter does not require these packages directly. It accesses them through `Lib`, which the application populates before constructing the Auth parent.

| Package | Reads via `Lib` |
|---|---|
| `@superloomdev/js-helper-utils` | `Lib.Utils` for type checks in `store.validators.js` |
| `@superloomdev/js-helper-debug` | `Lib.Debug` for driver-error logging |
| `@superloomdev/js-server-helper-nosql-aws-dynamodb` | `Lib.DynamoDB` via `STORE_CONFIG.lib_dynamodb` |

The driver helper carries its own dependency on the AWS SDK for JavaScript v3. The adapter never `require`s the AWS SDK directly; applications that never use this store never load the DynamoDB client.

## Environment Variables

The adapter reads no environment variables at runtime. The variables below are consumed by `_test/loader.js` and `_test/package.json` only; production deployments pass configuration directly through the `Lib.DynamoDB` loader.

| Variable | Default (Docker) | Purpose |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region for the SDK client |
| `AWS_ACCESS_KEY_ID` | `local` | Dummy credential for local emulator |
| `AWS_SECRET_ACCESS_KEY` | `local` | Dummy credential for local emulator |
| `DYNAMO_ENDPOINT` | `http://127.0.0.1:8001` | Endpoint override for DynamoDB Local emulator |

The endpoint port is **8001**, not 8000. This avoids collision with other local services. The test `package.json` hardcodes `http://127.0.0.1:8001`; override via `DYNAMO_ENDPOINT` if your local setup differs.

## Testing Tier

Service-dependent. The contract test suite runs against the DynamoDB Local emulator via Docker.

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automated by `npm test`:
- `pretest`: `docker compose down -v --remove-orphans` (defensive cleanup), then `docker compose up -d --wait` to start the `amazon/dynamodb-local` container on port 8001
- `test`: Runs the contract suite with dummy AWS credentials (`local`/`local`) against the emulator
- `posttest`: Removes containers and volumes (the image stays cached)

No manual `docker compose up` step is required. No real AWS account is required; the emulator handles all DynamoDB operations locally.

The test entry point is `_test/test.js`. It loads `_test/store-contract-suite.js`, which contains a local copy of the shared contract suite maintained by the Auth parent module. Keeping the suite local (rather than fetching from the parent at test time) means the adapter's test harness is self-contained and records which contract version it was built against.

The suite covers two tiers:

- **Tier 1. Adapter unit tests.** Store loader config validation; PK/SK construction; `custom_data` native Map storage; hash-mismatch "not found" behavior; `updateSessionActivity` identity blocklist (including `session_key`); upsert immutability; `cleanupExpiredSessions` deleted count
- **Tier 3. Full Auth lifecycle integration.** Every public Auth API path driven against the real DynamoDB Local backend through the store contract suite. Catches integration bugs that the unit tests cannot see (parent-side ordering, error envelope propagation, TTL interaction)

Tier 2 (an in-process emulated backend) is not applicable to DynamoDB. The emulator provides a real DynamoDB API surface; emulating it in-process would require reimplementing the AWS SDK.
