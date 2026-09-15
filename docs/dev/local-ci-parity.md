# Local CI Parity

> **Language:** JavaScript

A local verification runner exists so a push does not fail in CI for a reason the workstation could have caught. This document defines the contract every repository with a CI workflow must satisfy. The contract is a set of required properties, not a specific implementation. A repository conforms by shipping artifacts that satisfy each property, using whatever mechanisms fit its stack.

## On This Page

- [Why a Local Runner Exists](#why-a-local-runner-exists)
- [The Contract](#the-contract)
- [Enumerate Every Step](#enumerate-every-step)
- [The Closed Set of Unreplicable Reasons](#the-closed-set-of-unreplicable-reasons)
- [Isolate the Install Scope](#isolate-the-install-scope)
- [Match Tool Settings](#match-tool-settings)
- [Enforce the Pre-Push Command](#enforce-the-pre-push-command)
- [Fixture Every Historical Failure](#fixture-every-historical-failure)
- [A Repository Without Playwright](#a-repository-without-playwright)
- [Conformance Checklist](#conformance-checklist)

---
## Why a Local Runner Exists

CI catches broken code, but only after it reaches GitHub. A local runner catches the same failures before the push, in seconds, without a public red build. The local runner is not a replacement for CI. It is a structural mirror that fails locally when CI would fail remotely.

The gap this closes is not "CI is slow." The gap is "the documented pre-push command was skipped, and nothing enforced it." Two red CI runs were caused by running `npm run lint` instead of `npm run verify`. Lint is a subset of verify. The subset passed, the push went up, and CI caught the real failure minutes later. A local runner with a pre-push gate makes that mistake mechanically impossible.

See [`cicd-publishing.md`](cicd-publishing.md) for the CI pipeline itself, and [`testing-local-modules.md`](testing-local-modules.md) for the module test tier.

## The Contract

A conforming repository ships five artifacts. Each satisfies one property. The implementation is repo-specific; the property is universal.

1. A **step map** that enumerates every CI step and classifies each as replayed, unreplicable, or unmapped.
2. An **install-scope isolation** mechanism for any CI job that installs a subset of what the workstation has.
3. A **tool-settings parity** check for each tool CI uses, so local and CI settings cannot diverge.
4. A **pre-push gate** that refuses a push unless the full local verify ran since the last content change.
5. A **fixture** for every historical failure mode, planted and proven to fire before the check ships.

The closed set of unreplicable reasons is defined below. A step cannot be moved into the unreplicable set to make a local runner pass. The set is enforced by code, not by convention.

## Enumerate Every Step

The step map is a TSV file at the repository root: `.ci-step-map.tsv`. Each row maps one CI step to a local gate name. The census tool reads the workflow file, resolves each step against the map, and reports:

```javascript
ci parity: steps 40  mapped 16  unreplicable 24  unmapped 0
```

If any step is unmapped, the census exits nonzero and prints one line per unmapped step:

```javascript
UNMAPPED lint :: Fixture unmapped step :: no local counterpart and no signed unreplicable row
```

The local runner calls `--check-map` before running any gate. If the check fails, the runner stops. This prevents a new CI step from silently escaping local verification.

The runner also calls `--assert-executed` after the full run. This checks that every replayed gate was actually executed. A mapping that exists but is never run is the same as no mapping.

The census tool is `scripts/ci-census.js`. It supports three modes:

- Default: TSV output of every step with its classification.
- `--json`: JSON array with job, name, kind, run body, class, and local gate.
- `--check-map`: parity summary, exits 1 if any step is unmapped.
- `--assert-executed GATES`: checks that every replayed gate was executed.

## The Closed Set of Unreplicable Reasons

A CI step that cannot run locally is classified as unreplicable. The reason must begin with one of four approved prefixes:

- `hosted-runner-setup`: GitHub infrastructure (checkout, setup-node, cache).
- `artifact-upload`: artifact and test result uploads.
- `registry-publish`: package publishing to GitHub Packages.
- `native-toolchain: owner decision`: native builds requiring an SDK or runner image the workstation lacks.

Any other reason is rejected. "Too slow" is not an accepted reason. Slow checks stay in full verification rather than being classified as unreplicable.

The unreplicable rows live in `.ci-unreplicable.tsv` at the repository root. Each row is signed by the owner with a date. The census tool rejects any row whose reason does not begin with an approved prefix.

## Isolate the Install Scope

A CI job that installs only a subset of the repository can fail when a local run passes, because the workstation has sibling installs the CI job never performs. This actually broke CI: a test read `hosts/web/node_modules/...`, passed locally, and failed in CI where `hosts/web` was never installed.

The isolation mechanism snapshots the working tree as git sees it: tracked files plus untracked non-ignored files, nothing else. The snapshot excludes installed trees and other ignored content. The CI job replays from the snapshot, so a test reading a sibling install fails locally the same way it fails in CI.

The script is `scripts/verify-isolated.sh`. It takes a working directory and a command:

```sh
bash scripts/verify-isolated.sh src/_test 'npm ci --silent --cache "$(mktemp -d)" && npm test'
```

The script rejects a snapshot containing `hosts/web/node_modules` or root `node_modules`.

## Match Tool Settings

Each tool CI uses must have identical settings locally and in CI. A tool whose settings diverge can pass locally and fail in CI, or vice versa.

For Playwright, the settings that matter are:

- `workers`: CI uses 1. Local must use 1.
- `retries`: CI uses 2. Local must use 2.
- `forbidOnly`: CI is true. Local must be true.
- `reuseExistingServer`: CI is false. Local must be false.

The config must not branch on `process.env.CI`. The settings are unconditional. A parity output line is printed before the E2E gate runs:

```javascript
ci parity: playwright workers=1 retries=2 forbidOnly=true reuseExistingServer=false
```

For tools without CI-specific settings, this property is satisfied by having no settings to match.

## Enforce the Pre-Push Command

The pre-push gate is a git hook at `.githooks/pre-push`. It refuses a push unless a full `npm run verify` has run since the last content change.

The stamp is content-based. After a successful full verify, the runner writes `.verify-stamp` containing a SHA-256 hash of every tracked and untracked non-ignored file. The hook recomputes the hash and compares. If the stamp is missing or stale, the push is blocked with a message telling the developer to run verify.

The hash script is `scripts/content-hash.sh`. The stamp file is gitignored.

To enable the hook, run this once per clone:

```sh
git config core.hooksPath .githooks
```

This command modifies local git config. It is the only step in the contract that requires a manual setup action.

## Fixture Every Historical Failure

Every check the local runner enforces must have a planted violation that proves it fires. A check that has never been observed failing is not a check. The fixture is planted, the check runs and fails for the expected reason, the fixture is removed, and the check re-runs clean.

The historical failure modes are:

1. **Stale tarball**: a resolved shasum in a lockfile no longer matches the registry. The freshness check reports the stale pin.
2. **Install scope leak**: a test reads a sibling host install. Both the grep gate and the isolated replay fail.
3. **Docs regeneration**: a generated file is stale. The docs gate fails naming the file.
4. **Vendor terminology**: a banned vendor term appears in a generic module. The terminology gate fails.
5. **Unmapped step**: a CI step with no local mapping. The census check fails with an UNMAPPED line.

Each fixture is planted in the working tree, run, observed failing, restored byte-for-byte, and re-run clean. The evidence is recorded.

## A Repository Without Playwright

A repository without Playwright conforms by having no Playwright rows in its step map. The contract says "for each tool the repo's CI actually uses, match its settings." Absence of a tool is conformant. A repo with no E2E, no visual tests, and no browser install has zero Playwright rows and zero settings to match.

The same principle applies to any tool. A repo with no native builds has zero native-toolchain rows. A repo with no publish job has zero registry-publish rows. The contract defines what must hold for each tool that is present, not which tools must be present.

## Conformance Checklist

A repository conforms when all of the following are true:

- `scripts/ci-census.js` exists and runs `--check-map` with `unmapped 0`.
- `.ci-step-map.tsv` exists and maps every replayed CI step to a local gate.
- `.ci-unreplicable.tsv` exists and every reason begins with an approved D7 prefix.
- `scripts/content-hash.sh` exists and produces a stable hash.
- `.githooks/pre-push` exists and blocks on a missing or stale stamp.
- `.verify-stamp` is in `.gitignore`.
- The local runner calls `--check-map` before any gate and `--assert-executed` after the full run.
- Install-scope isolation exists for any CI job that installs a subset.
- Tool settings are unconditional and match CI for every tool the repo uses.
- Every historical failure mode has a fixture that was planted, fired, and restored.

The workspace-level audit script `__dev__/audits/ci-parity-conformance.sh` checks all of the above. Run it against any repo to verify conformance.

See [`pitfalls.md#ci-cd-publishing`](pitfalls.md#ci-cd-publishing) for the failure modes that taught these rules, and [`../languages/js/client/rn-testing.md`](../languages/js/client/rn-testing.md) for the application UI acceptance gates.
