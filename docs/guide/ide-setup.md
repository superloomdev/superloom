# IDE Setup

Recommended IDE configuration for working comfortably in a Superloom codebase. Everything below is a suggestion - you are free to use your own preferences. The only hard requirement is that the language's linter runs cleanly on every file you commit (ESLint for JavaScript modules).

## Windsurf / VS Code / Cursor

All three IDEs share the same settings model. Apply these in your user `settings.json` or in a project-level `.vscode/settings.json`.

### Editor Settings

| Setting | Recommended | Why |
|---|---|---|
| `editor.tabSize` | `2` | Matches the project's coding standard |
| `editor.insertSpaces` | `true` | Project uses spaces, not tabs |
| `editor.formatOnSave` | `false` | ESLint owns formatting; double-formatting fights ESLint |
| `editor.suggestOnTriggerCharacters` | `false` | Reduces noise while typing strict patterns |
| `terminal.integrated.cwd` | `"${fileDirname}"` | New terminals open in the folder of the active file |

### ESLint Integration

1. Install the **ESLint** extension
2. Enable `eslint.format.enable` and `editor.codeActionsOnSave: { "source.fixAll.eslint": "always" }`
3. ESLint v9+ requires a flat config (`eslint.config.js`) at the module root. Every Superloom module already has one

With these settings, you rarely need to run `npm run lint` manually during development. CI runs it on every push regardless.

### AI Assistant Integration (Windsurf)

Windsurf reads `AGENTS.md` automatically at conversation start - no configuration needed. The `.windsurf/workflows/` directory holds slash-command workflows; invoke them with `/new-entity`, `/new-helper`, `/migrate-module`, `/test`, `/review`, `/learn`, or `/propagate-changes`.

For GitHub MCP integration (so the assistant can manage repos, Actions, and PRs), follow [`dev/mcp-github-setup.md`](../dev/mcp-github-setup.md).

## Other IDEs (JetBrains, Sublime, neovim, ...)

The principles transfer:

- **Indentation:** 2 spaces, not tabs
- **Linter:** ESLint for JavaScript modules, configured to use the flat config (`eslint.config.js`) at the module root
- **Auto-fix on save:** strongly recommended
- **Quote style:** single quotes for JavaScript strings
- **Trailing commas:** off

Check your IDE's ESLint plugin documentation for the auto-fix-on-save equivalent.
