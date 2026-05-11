# Getting Started

A 10-minute walkthrough that gets you from a clean machine to a running Superloom project. By the end, you will have a copy of the demo project running locally and the test suite passing.

## On This Page

- [Prerequisites](#prerequisites)
- [Step 1 - Create Your Project](#step-1---create-your-project)
- [Step 2 - Install Dependencies](#step-2---install-dependencies)
- [Step 3 - Run the Server](#step-3---run-the-server)
- [Step 4 - Run the Tests](#step-4---run-the-tests)
- [Project Layout](#project-layout)
- [Where to Next](#where-to-next)

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Node.js** | 24.x recommended (most modules support `>=20.19`) | Runtime |
| **npm** | 10.x or higher | Package manager |
| **Git** | Any recent | Version control |
| **Docker Desktop** | Latest | Optional - only needed for service-dependent module tests |

If you plan to consume published `@your-org/*` packages, follow [`dev/onboarding-github-packages.md`](../dev/onboarding-github-packages.md) first to set up a GitHub Packages token.

---

## Step 1 - Choose Your Implementation Approach

Before creating your project, decide how you want to integrate helper modules:

### Approach 1: Fork and Publish (Recommended for teams)
```bash
# Fork this repository to your GitHub account
# Clone your fork
git clone https://github.com/YOUR-USERNAME/superloom.git
cd superloom

# Create your organization's packages
# Modify helper modules as needed
# Set up CI/CD to publish as @your-org/*
```
**Pros**: Custom functionality, version control, package distribution  
**Cons**: Requires CI/CD setup, external dependency

### Approach 2: Local Copy (Zero dependencies)
```bash
# Clone the framework
git clone https://github.com/superloomdev/superloom.git
cd superloom

# Copy helper modules into your project
cp -r src/helper-modules-* ../my-project/src/
cp -r demo-project/ ../my-project/
cd ../my-project

# Initialize git
git init
```
**Pros**: Zero external dependencies, complete control, offline development  
**Cons**: Manual updates, larger repository size

### Approach 3: Direct Usage (Quick start)
```bash
# Clone the demo project only
git clone https://github.com/superloomdev/superloom.git
cd superloom

cp -r demo-project/ ../my-project/
cd ../my-project

# Initialize git
git init
```
**Pros**: Quick setup, automatic updates, no maintenance  
**Cons**: External dependency, limited customization

---

## Step 2 - Install Dependencies

The demo project is a multi-package layout. Each top-level directory under `src/` is its own package with its own `package.json`. Install the ones you need:

```bash
cd src/model && npm install         # Base domain models (shared)
cd ../model-server && npm install   # Server-only model extensions
cd ../model-client && npm install   # Client-only model extensions (optional)
cd ../server && npm install         # Server runtime (Express + service + controller layers)
```

Each `package.json` references the shared helper modules. The dependency approach varies by your chosen implementation:

### Approach 1: Fork and Publish
```json
{
  "dependencies": {
    "@your-org/js-helper-utils": "^1.0.0",
    "@your-org/js-helper-debug": "^1.0.0",
    "express": "^4.21.0"
  }
}
```

### Approach 2: Local Copy
```json
{
  "dependencies": {
    "js-helper-utils": "file:./src/helper-modules-core/js-helper-utils",
    "js-helper-debug": "file:./src/helper-modules-core/js-helper-debug",
    "express": "^4.21.0"
  }
}
```

### Approach 3: Direct Usage
```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0",
    "@superloomdev/js-helper-debug": "^1.0.0",
    "express": "^4.21.0"
  }
}
```

---

## Step 3 - Run the Server

```bash
cd src/server && npm start
# Server started on port 3000 [development]
```

Try an endpoint:

```bash
curl -X POST http://localhost:3000/user/create \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

---

## Step 4 - Run the Tests

Each package has its own test command:

```bash
cd src/model && npm test          # Base model tests
cd src/model-server && npm test   # Server model extension tests
cd src/server && npm run test:all # Controller and service tests
```

All tests use Node.js's built-in test runner (`node --test`) and `node:assert/strict` - no external test framework. See [`architecture/testing-strategy.md`](../architecture/testing-strategy.md) and [`architecture/unit-test-authoring-js.md`](../architecture/unit-test-authoring-js.md) for the conventions.

---

## Project Layout

```
my-project/
  ops/                              # Project-specific infrastructure runbook (numbered, sequential)
  src/
    model/                          # Base domain models (one package, many entities)
      [entity]/                     #   contact/, user/, survey/, ...
        [entity].config.js          #   Domain constants
        [entity].data.js            #   Canonical builders + DTOs
        [entity].errors.js          #   Domain error catalog
        [entity].validation.js      #   Pure validation
        [entity].process.js         #   Pure business logic
        index.js                    #   Package entry per entity
        _test/                      #   Tests with mock-data/
      package.json
    model-server/                   # Server-only model extensions (peer package)
      [entity]/                     #   Server-only fields and methods
      package.json
    model-client/                   # Client-only model extensions (peer package)
      [entity]/
      package.json
    server/
      common/                       # Bootstrap, config, loader, shared functions
      controller/                   # Thin adapters (validate, build DTO, delegate)
      service/                      # Business logic and orchestration
      interfaces/
        api/
          express/                  # Express routes (Docker deployment)
          lambda-aws/[entity]/      # Per-entity AWS Lambda handlers (Serverless)
        hook/                       # Webhook entry points (Slack, Stripe, ...)
        job/                        # Cron / background workers
      _deploy/
        docker/                     # Dockerfile and compose for self-hosted deployment
        serverless-aws/[entity]/    # Per-entity serverless.yml configs
      package.json
    client/                         # Reserved for future client applications
```

All personal secrets, environment files, and AI session notes live in `__dev__/` at the repository root - never committed.

---

## Where to Next

| Goal | Read |
|---|---|
| Add your first domain entity | [Creating Entities](./creating-entities-js.md) |
| Configure your IDE | [IDE Setup](./ide-setup.md) |
| Set up your dev machine end-to-end | [Developer Setup](../dev/README.md) |
| Understand why MVC | [Why MVC](../philosophy/why-mvc.md) |
| Understand the one-shape DTO rule | [DTO Philosophy (JavaScript)](../philosophy/dto-philosophy-js.md) |
| Read the full entity walkthrough | [Entity Creation Guide](../architecture/entity-creation-guide-js.mdx) |
