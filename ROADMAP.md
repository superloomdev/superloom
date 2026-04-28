# Superloom Project Roadmap

A sequential todo list for achieving production-ready Superloom with international standards.

---

## Phase 1: Environment & Staging Infrastructure
**Status:** `Pending` | **Priority:** High

### 1.1 Design Multi-Stage Environment Architecture
- [ ] Define environment stages: `local` (dev offline) → `sandbox` (non-prod infra) → `production`
- [ ] Document purpose of each stage and transition criteria
- [ ] Design environment variable structure for stage detection

### 1.2 Implement Environment Configuration System
- [ ] Create `config/environments/` structure with `local.js`, `sandbox.js`, `production.js`
- [ ] Implement environment loader that detects current stage
- [ ] Create stage-specific configuration overrides (DB connections, API endpoints, feature flags)

### 1.3 Sandbox Infrastructure Design
- [ ] Define sandbox DB structure (mirrors production schema, separate instance)
- [ ] Design sandbox isolation strategy (separate AWS account vs resource naming)
- [ ] Create sandbox → production promotion process

### 1.4 Stage-Specific Testing Strategy
- [ ] Local: Unit tests, mock external services
- [ ] Sandbox: Integration tests, real AWS services (non-prod), end-to-end flows
- [ ] Production: Smoke tests, monitoring, rollback procedures

---

## Phase 2: Developer Onboarding Documentation
**Status:** `Pending` | **Priority:** High

### 2.1 Comprehensive Setup Guide
- [ ] Prerequisites: Node.js 24.x+, Git, Docker, AWS CLI
- [ ] Git configuration (SSH keys, GPG signing if required)
- [ ] GitHub Package Registry setup (`.npmrc` with `@superloomdev` scope authentication)
- [ ] IDE configuration (VSCode/Cursor settings, extensions, Windsurf integration)

### 2.2 Project Structure Documentation
- [ ] Explain `demo-project/` as seed/template
- [ ] Document helper modules architecture (`core/`, `server/`, `client/`)
- [ ] Clarify entity-based organization (model → core → controller → interfaces)

### 2.3 GitHub Access & Package Registry
- [ ] GitHub organization access (`superloomdev`)
- [ ] Personal Access Token creation for package registry
- [ ] SSH key setup for private repositories
- [ ] Verify `npm install` works with GitHub Packages

### 2.4 Local Development Workflow
- [ ] Starting local Express server
- [ ] Running tests locally (`node --test`)
- [ ] Linting with ESLint 9+
- [ ] Using workflows: `/new-entity`, `/test`, `/review`

---

## Phase 3: Infrastructure Implementation
**Status:** `Pending` | **Priority:** High

### 3.1 Docker Infrastructure
- [ ] Create `Dockerfile` for Express server
- [ ] Create `docker-compose.yml` for local development stack
- [ ] Include services: App container, Local DynamoDB (if needed), Redis (if needed)
- [ ] Document testing approach in Docker (containerized test runner)

### 3.2 AWS Infrastructure Setup
- [ ] Define AWS account structure (dev sandbox vs production)
- [ ] Create base Terraform/CDK templates for:
  - Lambda functions per entity
  - API Gateway configuration
  - DynamoDB tables
  - S3 buckets (if file upload needed)
  - IAM roles and policies
- [ ] Implement stage-specific resource naming (prefixes/suffixes)

### 3.3 Serverless Framework Integration
- [ ] Per-entity `serverless.yml` templates in `_deploy/`
- [ ] Stage-aware deployment scripts
- [ ] Environment variable injection from SSM Parameter Store
- [ ] Separate config files for `sandbox` and `production` stages

### 3.4 Testing in Each Infrastructure
- [ ] **Docker:** Local integration tests with containerized services
- [ ] **AWS Sandbox:** Deploy to sandbox, run integration tests against real AWS services
- [ ] **Production:** Post-deployment smoke tests, monitoring dashboards

---

## Phase 4: Basic Module Testing
**Status:** `Pending` | **Priority:** Medium

### 4.1 Create Test Entities
- [ ] Create 2-3 minimal entities using `/new-entity` workflow
- [ ] Cover: Simple CRUD entity, Entity with relations, Entity with file upload

### 4.2 Run Full Test Suite
- [ ] Unit tests: Model validation, core logic, controller input/output
- [ ] Integration tests: API endpoints (Express), Lambda handlers
- [ ] Verify all 84 existing tests pass
- [ ] Achieve 100% exported function coverage

### 4.3 Document Test Patterns
- [ ] Document `_test/test.js` structure
- [ ] Document mock data organization in `_test/mock-data/`
- [ ] Create testing best practices guide

---

## Phase 5: Refactoring for Industry Standards (Opus)
**Status:** `Pending` | **Priority:** Medium

### 5.1 Code Structure Refactoring
- [ ] Review object export patterns (ensure consistent named exports)
- [ ] Verify module boundaries (no circular dependencies)
- [ ] Ensure proper JSDoc annotations for all public APIs
- [ ] Validate naming conventions (snake_case JSON, camelCase JS)

### 5.2 Error Handling Standardization
- [ ] Consistent error classes across framework
- [ ] Proper error serialization for API responses
- [ ] Error codes and user-facing messages separation

### 5.3 Security Hardening
- [ ] Input validation on all entry points
- [ ] CORS configuration for Express
- [ ] Rate limiting implementation
- [ ] Secrets management audit (no hardcoded keys)

### 5.4 Performance Optimization
- [ ] Review async/await patterns
- [ ] Identify potential N+1 query issues
- [ ] Optimize bundle size for Lambda handlers

---

## Phase 6: Post-Refactor Validation
**Status:** `Pending` | **Priority:** Medium

### 6.1 Comprehensive Test Run
- [ ] Re-run all 84+ tests, fix any regressions
- [ ] Add tests for any gaps identified during refactoring
- [ ] Verify test coverage for all exported functions

### 6.2 Cross-Platform Testing
- [ ] Test on macOS (development environment)
- [ ] Test on Linux (Docker production environment)
- [ ] Verify no platform-specific code issues

### 6.3 Documentation Update
- [ ] Update `CONTEXT.md` with any API changes
- [ ] Update entity READMEs if patterns changed
- [ ] Update architecture docs in `docs/architecture/`

---

## Phase 7: Documentation Verification (Self-Testing)
**Status:** `Pending` | **Priority:** High

### 7.1 Clean Environment Recreation
- [ ] Create fresh VM/container with no pre-existing setup
- [ ] Follow setup documentation exactly as written
- [ ] Document any gaps, missing steps, or unclear instructions
- [ ] Fix documentation issues iteratively

### 7.2 Framework Pattern Validation
- [ ] Create test entities using documented workflows
- [ ] Verify generated structure matches standard:
  - Loader pattern (grouped by entity)
  - Comment style and documentation
  - Module organization (model/core/controller)
  - File structure consistency
- [ ] Validate `toPublic()` pattern for all entities
- [ ] Check vendor suffix convention (`lambda-aws`)

### 7.3 Opus Code Quality Review
- [ ] Review all code against industry best practices
- [ ] Verify consistency across all modules
- [ ] Check DTO patterns (single shape, `toPublic()` derivation)

### 7.4 Free Model Testing (Kimi)
- [ ] Run Kimi against codebase for:
  - Unused code detection
  - Anti-pattern identification
  - Documentation completeness
  - Security issue detection
- [ ] Implement Kimi-suggested fixes
- [ ] Re-run full test suite after changes

---

## Phase 8: Convert Remaining JS Helper Files
**Status:** `Pending` | **Priority:** Low

### 8.1 Audit Existing Helpers
- [ ] Inventory helper modules from reference projects
- [ ] Categorize: `core/` (framework), `server/` (AWS, DB), `client/` (UI)
- [ ] Prioritize by project need

### 8.2 Core Helper Migration
- [ ] `js-helper-debug` → verify already in `src/helper-modules-core/`
- [ ] `js-helper-utils` → verify already in `src/helper-modules-core/`
- [ ] Identify additional core helpers needed

### 8.3 Server Helper Migration
- [ ] Database helpers (DynamoDB wrapper)
- [ ] AWS SDK helpers (S3, SES, SSM)
- [ ] Authentication/authorization helpers
- [ ] File upload handlers

### 8.4 Client Helper Migration
- [ ] API client wrappers
- [ ] Form validation utilities
- [ ] UI component helpers

### 8.5 Testing & Documentation
- [ ] Add tests for each helper module
- [ ] Create README for each helper
- [ ] Update `CONTEXT.md` with helper catalog

---

## Phase 9: Final Production Readiness
**Status:** `Pending` | **Priority:** High

### 9.1 CI/CD Pipeline Completion
- [ ] GitHub Actions for testing on PR
- [ ] Automated versioning with Conventional Commits
- [ ] Automated npm publishing for helper modules
- [ ] Deployment automation for sandbox and production

### 9.2 Monitoring & Observability
- [ ] Logging standards (structured JSON logs)
- [ ] Error tracking integration
- [ ] Performance metrics collection
- [ ] Health check endpoints

### 9.3 Security Audit
- [ ] Dependency vulnerability scan
- [ ] Secrets rotation procedures
- [ ] Access control review
- [ ] Penetration testing guide for sandbox

### 9.4 Final Documentation Review
- [ ] Architecture Decision Records (ADRs) for major choices
- [ ] Troubleshooting guide
- [ ] FAQ for common developer issues
- [ ] Migration guide for framework updates

---

## Quick Reference: Key Conventions to Maintain

| Aspect | Convention |
|--------|------------|
| Environments | `local` → `sandbox` → `production` |
| JSON Keys | `snake_case` |
| JS Variables | `camelCase` |
| American English | `initialize` (with Z, not British `initialise`) |
| Vendor Suffix | `lambda-aws` (not `aws-lambda`) |
| Data Pattern | `toPublic(full_object)` strips server fields |
| Exports | Named exports only, consistent patterns |
| Tests | `node --test`, `node:assert/strict` |
| Spacing | 3 lines between sections, 2 between functions, 1 internal |

---

## Success Criteria

- [ ] New developer can set up project in < 30 minutes using only docs
- [ ] All environments (local/sandbox/production) deploy and test cleanly
- [ ] 100% test coverage on all exported functions
- [ ] Code passes Kimi + Opus quality review
- [ ] All helper modules migrated with tests
- [ ] CI/CD fully automated with zero manual intervention for standard deploys

---

**Last Updated:** 2026-04-02  
**Next Review:** After Phase 1 completion
