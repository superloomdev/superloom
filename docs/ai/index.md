# AI-Assisted Development

Superloom treats AI agents as a permanent development audience: code and documentation are structured so agents produce conforming work, and the standards for configuring, instructing, and dividing labor with agents are documentation in their own right. This section holds those standards. They are vendor-neutral: the same files and conventions work across agent tooling generations.

## Documents

| Document | Covers |
|---|---|
| [Agent Configuration](agent-configuration.md) | The `AGENTS.md` standard, tool-specific folders, the size budget, module-level `ROBOTS.md` |
| [Workflow Authoring](workflow-authoring.md) | How to write workflows agents execute with precision: phases, gates, evidence, convergence |
| [Model Tiering](model-tiering.md) | Dividing work between expensive reasoning models and inexpensive execution models |

## The Operating Ideas

Three ideas run through this section:

- **Ambient rules and procedures are different things.** An agent editing existing code needs standing knowledge (`AGENTS.md`, loaded every conversation). An agent performing a lifecycle operation (create, review, publish) needs a procedure (a workflow, loaded on invocation). Splitting by access pattern keeps the standing context small and the procedures complete.
- **Execution content is embedded, rationale is referenced.** Agents execute reliably from content inside the file they are running, and unreliably across links. Workflows therefore embed everything execution-critical, and a compile step keeps the embedded copies synchronized with their canonical sources.
- **Evidence over trust.** Agents claim completion optimistically. Every standard in this section demands visible evidence (quotes, tables, verdict lines, convergence statements) precisely because unverifiable claims are the primary agent failure mode.

## Related

- [Documentation Authoring](../principles/documentation-authoring.md) - the writing contract, including the derived-artifact Golden Rule
- [File Archetypes](../principles/file-archetypes.md) - the structural conformance model agents generate against
- [Planning System](../dev/planning.md) - the persistent plan files that carry long-horizon work across agent sessions
