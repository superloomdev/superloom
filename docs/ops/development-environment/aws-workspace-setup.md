# Development Environment Guide

## Overview

Most Superloom development happens locally using Docker for service dependencies. Cloud-based workspaces (AWS WorkSpaces, GitHub Codespaces) are optional for teams requiring standardized environments.

## Local Development (Recommended)

### Prerequisites

- Node.js 24+
- Docker Desktop
- Git access to the repository

### Quick Start

```bash
# Start local services (databases, S3-compatible store, queue)
docker compose -f docs/dev/docker-compose.yml up -d

# Load environment variables
source init-env.sh    # Select 'dev'

# Run tests for any module
cd src/helper-modules-core/js-helper-utils/_test
npm install
npm test
```

See `docs/dev/README.md` for the full developer onboarding guide.

## Cloud Workspaces (Optional)

Use cloud-based development environments when:
- Team needs standardized, pre-configured environments
- Local machines have insufficient resources
- Security policies require centralized development

### AWS WorkSpaces

- AWS Console → WorkSpaces → Create WorkSpace
- Select an appropriate compute bundle
- Use Auto-Stop running mode for cost optimization

### GitHub Codespaces

- Repository → Code → Codespaces → New Codespace
- Configure via `.devcontainer/devcontainer.json`

## Notes

- Local development is preferred for speed and offline capability
- Cloud workspaces add latency but ensure consistency across the team
