# Third-Party Library Policy

The project's default position is **self-contained code**. Every npm dependency is a long-term liability: supply-chain risk, version churn, license drift, abandoned maintainership, and divergence between what the library does and what we actually need. Most "utility" libraries can and should be replaced by a few lines of in-house code that lives next to the calling site and is reviewed under the same standards as the rest of the codebase.

This document defines:

1. The default rule and the criteria for accepting an exception.
2. Where third-party code is allowed to live in the codebase.
3. The mandatory documentation rule that applies to every module that uses a third-party dependency.
4. The review cadence.

## On This Page

- [The Default Rule](#the-default-rule)
- [Decision Criteria](#decision-criteria)
- [Where Third-Party Code Is Allowed to Live](#where-third-party-code-is-allowed-to-live)
- [Module Documentation Requirement](#module-documentation-requirement)
- [Review Cadence](#review-cadence)

---

## The Default Rule

> **A new helper module should ship with zero npm `dependencies` unless every criterion in the next section is satisfied.**

For most utility-shaped problems (string manipulation, date math, basic crypto wrappers, simple parsers), the right answer is to write 20-50 lines of in-house code, place it in a `parts/` file or a Class A core helper, and own it.

This default is not a frugality posture. It is a correctness and longevity posture. Code we wrote, we can read; code we wrote, we can debug at 2am; code we wrote, no supply-chain attacker can replace under our feet.

When in doubt, **fall back to self-contained**. It is always safe to *add* a dependency later if real evidence accumulates that we cannot maintain the in-house version. It is much harder to *remove* a dependency once it has spread.

---

## Decision Criteria

A third-party dependency is acceptable **only** when **all** of the following are true. Failing any one of these reverts to the default rule.

| Criterion | Why it matters |
|---|---|
| **The surface is specialized, not generic.** The library encodes domain knowledge we would otherwise have to re-derive (an RFC grammar, a public-suffix list, a cryptographic primitive, a vendor SDK contract). Generic utility functions (`isEmpty`, `flatten`, `debounce`) do not qualify | Specialised knowledge ages well in a maintained library; we age badly tracking it |
| **The library has zero runtime dependencies.** Indirect deps multiply supply-chain surface area and version-conflict pain | Each transitive dep is a separately-trusted party |
| **The library is the de-facto standard for its problem.** Measured by weekly npm downloads in the top 1% for its category, broad reverse-dependent count (1000+ packages), and presence as a transitive dep of major frameworks | A library used by Express, Fastify, Koa, and Hono simultaneously has been battle-tested by every Node ecosystem actor; a niche library has not |
| **The maintainer is a recognised org with multiple active maintainers**, not a single hobbyist account | Solo-maintained packages are the canonical supply-chain attack vector (cf. `event-stream`, `colors.js`, `node-ipc`) |
| **The license is MIT, ISC, BSD-2/3, or Apache-2.0**, with no copyleft (GPL family) reach | License compatibility with downstream commercial use |
| **The bundle size is small** (typically under 10 KB minified) | Cold-start cost on AWS Lambda, build-time cost on the client |
| **The behaviour cannot be reasonably re-implemented in-house** without re-deriving specification knowledge that has known edge cases or known security pitfalls | The library's value is the cumulative debugging that landed there over years |
| **The surface we use is narrow and stable.** We import the library at one point in the codebase (one helper module), wrap it behind an internal interface, and never let it leak elsewhere | Allows future replacement with zero ripple |

---

## Where Third-Party Code Is Allowed to Live

Even within an accepted third-party dependency, the `require()` call is confined to specific layers. This confinement is what makes a dependency reversible - swapping a library costs one PR against one file, not N PRs scattered across application code.

| Layer | Allowed to import third-party code directly? |
|---|---|
| **Helper module wrappers** (`parts/*.js` inside any helper module) | **Yes** - this is the only layer where a third-party `require()` belongs. The whole reason the library exists in this codebase is to be wrapped here |
| **Helper module loaders / validators / config / errors** | No - these files compose the wrapper; they must not reach around it |
| **Adapter packages** (e.g. `js-server-helper-http-gateway-adapter-aws-apigateway`) | **Yes**, but only for the runtime SDK the adapter targets (e.g. AWS SDK for the AWS adapter, `express` for the Express adapter). Not for cross-cutting utilities |
| **Application service / controller / model layers** | No - application code consumes wrappers via `Lib.*`, never `require()`s a third-party package directly |
| **Test fixtures** (`_test/**/*.js`) | No, with rare exception. Tests should reflect production import patterns; if a test needs functionality, the production wrapper should expose it |

---

## Module Documentation Requirement

**Every helper module that declares a runtime `dependency` in its `package.json` must document that dependency in its `README.md`.**

This rule exists because the decision to use a third-party library is not obvious from reading `package.json`. The README is the first file a new developer or reviewer reads. It must make the dependency visible, justify it, and explain what security concerns it addresses, so the decision does not have to be re-litigated from scratch every time someone sees the dependency.

This applies equally to all dependency categories:

- A pure-string codec (e.g. cookie parsing)
- A data-list library (e.g. public suffix lookup)
- A runtime SDK that the module fundamentally cannot operate without (e.g. AWS SDK in a DynamoDB helper - the module is the AWS SDK wrapper, and that is self-evident, but still documented)
- Any future accepted dependency

### Required Section in README

Every module README that has at least one runtime dependency must contain a **"Third-Party Dependencies"** section, placed **after the configuration reference and before the unit tests section**.

The section must cover each dependency listed in the module's `package.json` `dependencies` field (not `devDependencies`, not `peerDependencies`). For each dependency, document:

1. **Package name and what it does** - the specific surface the module uses, not the library's full feature set.
2. **Why the module uses it instead of in-house code** - the concrete technical reason. If the reason is security pitfalls in the problem space, name them.
3. **What criteria it satisfied** - a brief cross-reference to the eight criteria above, enough that a reader can verify the decision was deliberate.

The section does NOT need to repeat the full decision matrix from this document. A few sentences per dependency, plus a pointer to this document for the full rationale, is enough.

### Template

```markdown
## Third-Party Dependencies

This module declares the following runtime npm dependencies. Each was accepted
under the criteria in `docs/foundations/third-party-libraries.md`.

### [package-name]

[One sentence: what the library does and what specific surface this module uses
from it.]

[One paragraph: why in-house code is not used instead. Name the concrete
technical concerns - RFC grammar edge cases, security CVE classes, data sets
that cannot be re-derived, vendor SDK contracts that require the library to
exist at all.]
```

### Examples

A cookie codec dependency (security-driven carve-out):

> **`cookie` (jshttp).** Used for RFC 6265-compliant cookie string serialization (`stringifySetCookie`) and request header parsing (`parseCookie`). In-house code is not used because cookie handling contains several non-obvious security pitfalls: attribute injection via unencoded values, prototype pollution via hostile `__proto__=...` Cookie headers (CVE-2024-47764 class), and percent-decode crashes on malformed sequences. The library encapsulates 13 years of fixes to these pitfalls and tracks ongoing RFC 6265bis grammar revisions. The SameSite=None browser-quirk detection is handled in-house in `parts/cookies.js` because it is a product decision based on a historical browser bug list, not part of any RFC.

A data-list dependency (knowledge-set carve-out):

> **`tldts`.** Used to split a hostname into its registrable domain and public suffix via the Mozilla Public Suffix List. In-house code is not used because the Public Suffix List has thousands of entries, changes monthly with new ccTLDs and private suffixes, and cannot be approximated by any programmatic rule (there is no algorithm that determines `.co.uk` is a public suffix without the list).

A vendor SDK dependency (required-to-exist carve-out):

> **`@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`.** This module is the DynamoDB wrapper. The AWS SDK is the only supported mechanism for communicating with DynamoDB; there is no alternative and no in-house implementation is possible.

---

## Review Cadence

Every accepted dependency is re-evaluated under two triggers:

1. **Every new helper module.** When a new module's `package.json` declares a runtime `dependency`, the PR must include a "Third-Party Dependencies" section in that module's README as described above. Any dependency not matching a prior category must additionally justify against the eight criteria in this document.

2. **Annually.** Once per calendar year, each dependency across all modules is re-checked: is the library still maintained, has a CVE been disclosed, has a better alternative emerged, has the in-house cost-of-reimplementation changed (e.g., Node added a native API that subsumes the library).

A dependency can be *removed* (replaced with in-house code) at any time if the trade-off has shifted. New ones are added through the README documentation requirement - no central registry is needed; the READMEs are the inventory.

---

## Related Documents

- [Architectural Philosophy](architectural-philosophy.md) - "All external libraries wrapped" is one of the four coding-practice rules; this document is the detailed implementation of that rule
- [Error Handling](error-handling.md) - third-party libraries that throw exceptions are normalised at the wrapper boundary into the framework's error envelope
- [Module Categorization](../modules/module-categorization.md) - which module classes are allowed to declare runtime dependencies
