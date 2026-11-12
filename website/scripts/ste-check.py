#!/usr/bin/env python3
"""STE check: mechanical ASD-STE100 rules for agent-register Markdown files.

Usage:  python3 website/scripts/ste-check.py <file.md>...
Rules checked (docs/principles/documentation-authoring.md, Two Registers):
  LONG25  a sentence of more than 25 words (no sentence may pass 25)
  LONG20  a sentence of 21 to 25 words that starts with a verb (an instruction)
  SEMI    a semicolon in prose
  CONTR   a contraction
A code span, a link, a path or a number with its unit counts as one word.
Skipped: frontmatter, fenced code blocks, headings, table separator rows.
Exit: 0 when no finding, 1 otherwise. Output: one line per finding, then a count line.
"""

import re
import sys

CODE_SPAN = re.compile(r"`[^`]*`")
LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"`(\[*])")
BOLD_LABEL = re.compile(r"^\*\*[^*]+\*\*\s*")
CONTRACTION = re.compile(r"\b\w+(n't|'re|'ve|'ll|'m)\b", re.IGNORECASE)
IMPERATIVE = {
    "add", "apply", "ask", "build", "check", "commit", "compare", "confirm", "copy", "count", "create", "declare",
    "delete", "do", "edit", "enumerate", "extract", "find", "fix", "give", "hand", "keep", "list", "make", "mark",
    "move", "name", "open", "output", "print", "prove", "push", "put", "read", "record", "remove", "rename",
    "replace", "report", "re-run", "rerun", "restore", "run", "search", "select", "set", "show", "skip", "start",
    "state", "stop", "tell", "tick", "update", "use", "verify", "wait", "write",
}


def clean(text):
    # Count a code span or a link as one word
    text = CODE_SPAN.sub("X", text)
    text = LINK.sub(lambda m: m.group(1) or "X", text)
    return re.sub(r"[*_>]+", "", text).strip()


def list_units(path):
    # Yield (line number, text) for each prose unit: a line, or one table cell
    lines = open(path, encoding="utf-8").read().splitlines()
    in_code = False
    in_front = bool(lines) and lines[0].strip() == "---"
    for number, raw in enumerate(lines, 1):
        text = raw.strip()
        if in_front:
            if number > 1 and text == "---":
                in_front = False
            continue
        if text.startswith("```"):
            in_code = not in_code
            continue
        if in_code or not text or text.startswith("#") or re.fullmatch(r"\|?[\s:|-]+\|?", text):
            continue
        cells = [c for c in text.strip("|").split("|")] if text.startswith("|") else [text]
        for cell in cells:
            yield number, re.sub(r"^\s*(\d+\.|-|\*)\s+", "", cell)


def check(path):
    findings = []
    for number, unit in list_units(path):
        # A leading bold label ("**Label:** text") is a title, counted apart from its text
        unit = BOLD_LABEL.sub("", unit)
        raw_unit = CODE_SPAN.sub("X", unit)
        if ";" in raw_unit:
            findings.append((number, "SEMI", unit))
        if CONTRACTION.search(raw_unit):
            findings.append((number, "CONTR", unit))
        for sentence in SENTENCE_END.split(clean(unit)):
            words = sentence.split()
            first = words[0].lower().strip("\"'(") if words else ""
            if len(words) > 25:
                findings.append((number, f"LONG25 ({len(words)})", sentence))
            elif len(words) > 20 and first in IMPERATIVE:
                findings.append((number, f"LONG20 ({len(words)})", sentence))
    return findings


def main(paths):
    total = 0
    for path in paths:
        for number, rule, text in check(path):
            total += 1
            print(f"{path}:{number}: {rule}: {text[:110]}")
    print(f"STE findings: {total}")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
