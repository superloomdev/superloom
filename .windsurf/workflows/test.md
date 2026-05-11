---
auto_execution_mode: 0
description: Run tests for the current module or project
---

# Test Workflow

Run tests for the active Superloom module based on context. Detect the module type from the current working directory or active file, then execute the appropriate test command.

## Detect Module Type and Run Tests

### If in a Helper Module (`src/helper-modules-core/`, `src/helper-modules-server/`, `src/helper-modules-client/`)

// turbo
```bash
cd _test && npm install && npm test
```

### If in a Model Module (`demo-project/src/model/[entity]/`)

// turbo
```bash
cd _test && npm install && node --test test.js
```

### If in a Controller or Service Module (`demo-project/src/server/controller/` or `service/`)

// turbo
```bash
cd _test && npm install && node --test test.js
```

### Run All Demo Project Tests

// turbo
```bash
cd demo-project/src/model && npm test
cd demo-project/src/model-server && npm test
cd demo-project/src/server && npm run test:all
```

### Run Tests for Specific Entity

// turbo
```bash
cd demo-project/src/model && npm test
```

Example: `npm run test:user`, `npm run test:survey`, `npm run test:contact`

## Test Conventions

- Uses the Node.js built-in test runner (`node --test`)
- Test file: `_test/test.js`
- Assertions: `require('node:assert/strict')`
- Test naming: `should [expected behavior] when [condition]`
- Every exported function has at least one test case

Full rules: [`docs/architecture/unit-test-authoring.md`](../../docs/architecture/unit-test-authoring.md).
