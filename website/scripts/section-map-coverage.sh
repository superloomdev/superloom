#!/usr/bin/env bash
# section-map-coverage.sh - Verify every docs/*.md file has a Section Map row.
#
# Usage:
#   section-map-coverage.sh [repo-root]
#
# repo-root defaults to the current directory. The script expects:
#   - docs/ subtree with .md files
#   - .devin/workflows/finalize-docs.md containing a Section Map table
#
# Exits non-zero if any docs file is unmapped, printing each unmapped file.
# Exits zero with "all mapped" if every file is covered.

set -euo pipefail

REPO_ROOT="${1:-.}"

WORKFLOW="$REPO_ROOT/.devin/workflows/finalize-docs.md"
DOCS_DIR="$REPO_ROOT/docs"

if [ ! -f "$WORKFLOW" ]; then
  echo "ERROR: $WORKFLOW not found" >&2
  exit 2
fi

if [ ! -d "$DOCS_DIR" ]; then
  echo "ERROR: $DOCS_DIR not found" >&2
  exit 2
fi

# Extract the Section Map table (between "### P1" and the next "### " heading),
# pull every table row starting with "| `docs/", and extract the first cell
# (the source path column). Handles:
#   - Wildcards: docs/ops/**, docs/languages/js/server/*
#   - Multi-file rows: `docs/a.md`, `b.md`, `c.md` (relative to first entry's dir)
#   - Backtick-quoted paths with or without docs/ prefix

python3 - "$WORKFLOW" "$DOCS_DIR" <<'PYEOF'
import re, glob, os, sys

workflow = sys.argv[1]
docs_dir = sys.argv[2]

with open(workflow) as f:
    content = f.read()

# Isolate the Section Map table: from "### P1" to the next "### " heading
m = re.search(r'### P1.*?(?=^### )', content, re.S | re.M)
if not m:
    print("ERROR: could not locate Section Map (### P1) in workflow", file=sys.stderr)
    sys.exit(2)
section = m.group(0)

# All actual docs files
all_docs = sorted(glob.glob(os.path.join(docs_dir, '**', '*.md'), recursive=True))
all_docs = [os.path.relpath(f, os.path.dirname(docs_dir)) for f in all_docs]
all_set = set(all_docs)

# Parse table rows: lines starting with "| `docs/"
expanded = set()
for line in section.split('\n'):
    if not re.match(r'\|\s*`docs/', line):
        continue
    # First cell = source column
    cells = line.split('|')
    if len(cells) < 3:
        continue
    cell = cells[1].strip()
    # Split on commas for multi-file rows
    parts = [p.strip().strip('`') for p in cell.split(',')]
    base_dir = None
    for p in parts:
        if p.startswith('docs/'):
            base_dir = os.path.dirname(p)
            if '*' in p:
                for f in glob.glob(p, recursive=True):
                    expanded.add(f)
            else:
                expanded.add(p)
        elif base_dir and p:
            full = os.path.join(base_dir, p)
            if '*' in full:
                for f in glob.glob(full, recursive=True):
                    expanded.add(f)
            else:
                expanded.add(full)

unmapped = sorted(all_set - expanded)
mapped_count = len(all_set & expanded)
total = len(all_set)

if unmapped:
    print(f"UNMAPPED: {len(unmapped)} of {total} docs files have no Section Map row")
    print()
    for f in unmapped:
        print(f"  {f}")
    print()
    print(f"mapped: {mapped_count}/{total}")
    sys.exit(1)
else:
    print(f"all mapped: {mapped_count}/{total} docs files have a Section Map row")
    sys.exit(0)
PYEOF
