# Getting Started

> **Audience.** Application developers building *with* Superloom. If you are contributing to the framework itself (helper modules, demo project, docs), start at [`../dev/README.md`](../dev/README.md) instead.

A walkthrough that gets you from a clean machine to a running Superloom project. The framework is structured the same way regardless of language - models, services, controllers, interfaces - and each language has its own implementation guide. This guide covers the **JavaScript (Node.js)** implementation, which is the current reference implementation.

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
| **Node.js** | 24.x or higher | Runtime |
| **npm** | 10.x or higher | Package manager |
| **Git** | Any recent | Version control |
| **Docker Desktop** | Latest | Optional - only needed for service-dependent module tests |

If you plan to consume published `@your-org/*` packages, follow [`dev/onboarding-github-packages.md`](../dev/onboarding-github-packages.md) first to set up a GitHub Packages token.

---

## Step 1 - Choose Your Implementation Approach

Before creating your project, decide how you want to integrate helper modules:

### Approach 1: Fork and Publish (Recommended for teams)
```bash
# Fork superloomdev/js-helper-modules to your GitHub account
# Clone your fork
git clone https://github.com/YOUR-USERNAME/js-helper-modules.git

# Modify helper modules as needed
# Set up CI/CD to publish as @your-org/*
```
**Pros**: Custom functionality, version control, package distribution  
**Cons**: Requires CI/CD setup, external dependency

### Approach 2: Local Copy (Zero dependencies)
```bash
# Clone the helper modules repo
git clone https://github.com/superloomdev/js-helper-modules.git

# Clone the demo project repo
git clone https://github.com/superloomdev/js-demo-project.git

# Copy helper modules into your project
cp -r js-helper-modules/src/helper-modules-*/* my-project/helpers/

# Copy the demo project source into your project
cp -r js-demo-project/src/ my-project/src/

# Initialize git in your project
git init my-project
```
**Pros**: Zero external dependencies, complete control, offline development  
**Cons**: Manual updates, larger repository size

### Approach 3: Direct Usage (Quick start)
```bash
# Clone the demo project
git clone https://github.com/superloomdev/js-demo-project.git my-project

# Initialize git in your project
git init my-project
```
**Pros**: Quick setup, automatic updates, no maintenance  
**Cons**: External dependency, limited customization

---

## Step 2 - Install Dependencies

A Superloom project uses a multi-package layout. Each top-level directory under `src/` is its own package with its own dependency manifest. Install dependencies for each package you plan to use.

In a JavaScript project this means running `npm install` from each package directory. For example:

```bash
npm install   # from src/model         (base domain models, shared)
npm install   # from src/model-server  (server-only model extensions)
npm install   # from src/server        (server runtime, Express + service + controller)
```

Other language implementations follow the same per-package pattern with their own package manager (`pip install`, `bundle install`, etc.).

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
    "js-helper-utils": "file:./helpers/js-helper-utils",
    "js-helper-debug": "file:./helpers/js-helper-debug",
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

Each package runs its own test suite independently. Run the tests from each package directory.

In a JavaScript project this means running `npm test` from each package directory. For example:

```bash
npm test            # from src/model         (base model tests)
npm test            # from src/model-server  (server model extension tests)
npm run test:all    # from src/server        (controller and service tests)
```

JavaScript tests use Node.js's built-in test runner (`node --test`) and `node:assert/strict` with no external test framework. See [`testing/testing-strategy.md`](../testing/testing-strategy.md) and [`testing/unit-test-authoring-js.md`](../testing/unit-test-authoring-js.md) for the conventions.

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

All personal secrets, environment files, and AI session notes live in `__dev__/` at the workspace root (the parent directory that contains all your repo clones) - never committed to any repository.

---

## Where to Next

| Goal | Read |
|---|---|
| Add your first domain entity | [Creating Entities](./creating-entities-js.md) |
| Configure your IDE | [IDE Setup](./ide-setup.md) |
| Set up your dev machine end-to-end | [Developer Setup](../dev/README.md) |
| Understand the server architecture pattern | [Why the Server Uses MVC](../philosophy/why-server-mvc.md) |
| Understand the one-shape DTO rule | [DTO Philosophy (JavaScript)](../philosophy/dto-philosophy-js.md) |
| Read the full entity walkthrough | [Entity Creation Guide](../server/entity-creation-guide-js) |
