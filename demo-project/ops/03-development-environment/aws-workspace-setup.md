# AWS Workspace Setup

> Reference: docs/ops/development-environment/aws-workspace-setup.md

## Prerequisites

- Completed: `01-cloud-provider/`

## Steps

### Set Up Virtual Workspace (Optional)

Only required if the team needs cloud-based development environments.

* AWS Console → WorkSpaces → Create WorkSpace
* Directory: `[TODO: Set up directory or use existing]`
* Bundle: `[TODO: Select appropriate compute bundle]`
* Running Mode: Auto-Stop (cost optimization)

### Local Development Environment

For local development, see the framework's developer setup:

* `docs/dev/README.md` - Developer onboarding and quick start
* `docs/dev/docker-compose.yml` - Local services (databases, S3-compatible store, queue)
* `init-env.sh` - Environment loader script

## Verification

- Developer can run `npm test` from any helper module's `_test/` directory
- Docker services start without errors

## Notes

- Most development is done locally using Docker for service dependencies
- Cloud workspaces are only needed for teams requiring standardized environments
