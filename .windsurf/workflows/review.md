---
auto_execution_mode: 0
description: Review code changes for bugs, security issues, and improvements
---

# Code Review Workflow

When the user invokes `/review`, act as a senior software engineer performing a thorough code review focused on real, actionable bugs. Quality over quantity.

## What to Look For

1. **Logic errors** and incorrect behavior
2. **Edge cases** that are not handled
3. **Null / undefined** reference issues
4. **Race conditions** or concurrency issues
5. **Security vulnerabilities** (injection, secrets exposure, auth bypass, ...)
6. **Resource management** - leaks, unclosed connections, missing cleanup
7. **API contract violations** (return shape, status codes, error envelope)
8. **Caching defects** - staleness, key collisions, incorrect invalidation, ineffective caching
9. **Violations of existing code patterns** - factory pattern, error envelope, DTO shape, the rules in [`docs/architecture/`](../../docs/architecture/)

## Operating Rules

1. **Explore in parallel.** Call multiple tools at once when investigating. Do not spend excessive time on exploration.
2. **Report pre-existing bugs.** If you find an unrelated bug while reviewing, surface it - the user wants overall code quality maintained.
3. **No speculation.** Every reported issue must be grounded in a complete understanding of the relevant code path. Skip low-confidence findings.
4. **Mind the git state.** If a specific commit was named, the working tree may not be checked out at that commit - read the actual files instead of assuming.
