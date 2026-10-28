# Use Superloom in Your Project

Superloom works two ways: as the framework you build JavaScript helper
modules with, and as a set of engineering principles your own project can
adopt in its own idiom, in any language, on any platform. This guide is
the second way, called use mode.

## What use mode gives you

Use mode lets an AI agent adopt Superloom into a project that is not a
Superloom project. The agent studies your project, writes your project's
own principles in your platform's own style, and hands you docs and a
code plan to review. When the adoption finishes, your project stands on
its own documentation and runs without Superloom. Nothing in your
project keeps referencing Superloom except one credit line.

## The steps

1. Add the `codebase-superloom` folder to your project's workspace so
   your agent can read it.
2. Say `start`.
3. Answer up to four questions. Each one names a defensible option and a
   recommendation, so the answer is usually "yes".
4. Review the digest, the docs, and the code plan the agent produced.
5. Remove the Superloom folder from the workspace. Your project no
   longer needs it.
6. Open a new session and say `start` again. The agent now answers from
   your project's own `AGENTS.md`, not from Superloom's rules.

## What you get

Your project gains its own layered documentation: universal principles,
a platform layer in your language and stack's own idiom, agent-operation
rules, a conventions registry, and a plan your team and your agent both
follow. The full layout is a table in
[Adopting Superloom](../principles/adopting-superloom.md#the-adopted-layout).

## Refreshing later

Run `start` again with the Superloom folder back in the workspace.
The refresh flow compares your docs to the current Superloom doctrine
and proposes updates. Your project keeps every local decision it made.

## Starting a brand-new project

Say `start` with no other project open. The agent offers to create one
and bootstraps the same layout from zero.

## Working on Superloom itself

When the project is Superloom itself, this guide does not apply. Say `dev mode` instead; the contributor ritual in
`docs/dev/` takes over from there.
