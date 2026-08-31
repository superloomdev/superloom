#!/usr/bin/env python3
"""TOC generator for `## On This Page` blocks.

Reads heading ids from the built HTML (ground truth) and regenerates the
`## On This Page` block in each docs file that already has one. The block
spans from `## On This Page` to the next `---` separator.

Anchors come from `website/DIST/**/*.html`, never from a reimplemented slug
rule. Link text is the heading text verbatim (including inline backticks).
Every H2 and H3 is listed except `On This Page` itself; no exclusion list.

The `On This Page` blocks are generated. Do not hand-edit them; the `--check`
gate will fail on the next build.

Usage:
  toc-generate.py [REPO_ROOT]              Write updated TOC blocks to all files.
  toc-generate.py [REPO_ROOT] --check      Exit non-zero if any block is stale.
  toc-generate.py [REPO_ROOT] --selftest   Run the self-test (probe file).

REPO_ROOT defaults to the codebase-superloom directory (sibling of __dev__).
"""
import re, os, glob, sys

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_REPO = os.path.normpath(os.path.join(_SCRIPT_DIR, "..", ".."))


def _paths(repo_root):
    return (
        os.path.join(repo_root, "docs"),
        os.path.join(repo_root, "website", "DIST"),
    )


def site_ids(dist, relpath):
    """Ordered list of (level, id) the site generated for this docs file.

    relpath is repo-relative (e.g. docs/guide/getting-started.md).
    """
    html = os.path.join(dist, relpath[:-3] + ".html")
    if not os.path.exists(html):
        return None
    with open(html, encoding="utf-8", errors="replace") as f:
        c = f.read()
    return [(int(l), i) for l, i in re.findall(r'<h([23])[^>]*\sid="([^"]+)"', c)]


def markdown_headings(path):
    """(level, text) for H2/H3 outside fenced code, excluding 'On This Page'."""
    out, fence = [], False
    with open(path, encoding="utf-8", errors="replace") as f:
        for ln in f:
            if ln.strip().startswith("```"):
                fence = not fence
                continue
            if fence:
                continue
            m = re.match(r'^(#{2,3})\s+(.*?)\s*$', ln)
            if m:
                lvl, txt = len(m.group(1)), m.group(2)
                if txt.strip() == "On This Page":
                    continue
                out.append((lvl, txt))
    return out


OTP_RE = re.compile(r'^## On This Page\s*$', re.MULTILINE)


def find_block(text):
    """Return (start, end) byte offsets of the On This Page block.

    The block starts at the `## On This Page` heading and ends at the next
    `---` line (inclusive of the separator and its trailing newline).
    Returns None if no block exists.
    """
    m = OTP_RE.search(text)
    if not m:
        return None
    start = m.start()
    # find the next `---` separator after the heading
    rest = text[m.end():]
    sep_re = re.compile(r'^---\s*$', re.MULTILINE)
    sm = sep_re.search(rest)
    if not sm:
        # block runs to end of file or next H2; treat as ending at next H2 or EOF
        h2_re = re.compile(r'^##\s+', re.MULTILINE)
        hm = h2_re.search(rest)
        if hm:
            end = m.end() + hm.start()
        else:
            end = len(text)
        return (start, end)
    end = m.end() + sm.end()
    # include the trailing newline after `---`
    if end < len(text) and text[end] == "\n":
        end += 1
    return (start, end)


def generate_block(relpath, docs, dist):
    """Return the new block text (including heading and separator), or None."""
    path = os.path.join(os.path.dirname(docs), relpath)
    hs = markdown_headings(path)
    ids = site_ids(dist, relpath)
    if ids is None:
        return None, "no built HTML"
    # filter out the on-this-page id from site ids
    ids = [(l, i) for l, i in ids if i != "on-this-page"]
    if len(ids) != len(hs):
        return None, f"MISMATCH: {len(hs)} md headings vs {len(ids)} site ids"
    lines = ["## On This Page", ""]
    for (lvl, txt), (_ilvl, anchor) in zip(hs, ids):
        indent = "" if lvl == 2 else "  "
        lines.append(f"{indent}- [{txt}](#{anchor})")
    lines.append("")
    lines.append("---")
    lines.append("")
    return "\n".join(lines), None


def process_file(relpath, docs, dist, check_only):
    """Return (status, detail). status is 'ok', 'updated', 'stale', 'skipped', 'error'."""
    path = os.path.join(os.path.dirname(docs), relpath)
    with open(path, encoding="utf-8") as f:
        text = f.read()
    block = find_block(text)
    if block is None:
        return "skipped", "no On This Page block"
    new_block, err = generate_block(relpath, docs, dist)
    if err:
        return "error", err
    start, end = block
    current = text[start:end]
    if current == new_block:
        return "ok", "already current"
    if check_only:
        return "stale", "block differs from generated"
    updated = text[:start] + new_block + text[end:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)
    return "updated", f"{len(new_block.splitlines())} lines"


def run(repo_root, check_only=False):
    docs, dist = _paths(repo_root)
    if not os.path.isdir(dist):
        print(f"ERROR: built HTML not found at {dist}. Run the website build first.")
        return 2
    if not os.path.isdir(docs):
        print(f"ERROR: docs directory not found at {docs}.")
        return 2

    repo = os.path.dirname(docs)
    stats = {"ok": 0, "updated": 0, "stale": 0, "skipped": 0, "error": 0}
    errors = []
    stale_files = []

    for md in sorted(glob.glob(os.path.join(docs, "**", "*.md"), recursive=True)):
        relpath = os.path.relpath(md, repo)
        status, detail = process_file(relpath, docs, dist, check_only)
        stats[status] += 1
        if status == "error":
            errors.append((relpath, detail))
        elif status == "stale":
            stale_files.append(relpath)
        elif status == "updated":
            print(f"  updated: {relpath} ({detail})")

    mode = "CHECK" if check_only else "WRITE"
    print(f"\n[{mode}] {stats['ok']} ok, {stats['updated']} updated, "
          f"{stats['stale']} stale, {stats['skipped']} skipped, {stats['error']} errors")

    if errors:
        print("\n=== ERRORS ===")
        for rel, detail in errors:
            print(f"  {rel}: {detail}")
        return 1
    if check_only and stats["stale"] > 0:
        print(f"\n{stats['stale']} file(s) have stale On This Page blocks:")
        for rel in stale_files:
            print(f"  {rel}")
        return 1
    return 0


def selftest(repo_root):
    """Plant a probe file with a known heading tree, assert exact output,
    assert a second run is a no-op, delete the probe."""
    docs, dist = _paths(repo_root)
    repo = os.path.dirname(docs)
    probe_rel = "docs/_selftest_toc.md"
    probe_md = os.path.join(repo, probe_rel)
    probe_html = os.path.join(dist, probe_rel[:-3] + ".html")

    md_content = (
        "# Probe\n\n"
        "## On This Page\n\n"
        "- [Stale Entry](#stale)\n\n"
        "---\n\n"
        "## First Section\n\n"
        "Body.\n\n"
        "### Subsection\n\n"
        "Body.\n\n"
        "## Second Section\n\n"
        "Body.\n"
    )
    # HTML with matching ids in document order
    html_content = (
        '<html><body>'
        '<h2 id="on-this-page">On This Page</h2>'
        '<h2 id="first-section">First Section</h2>'
        '<h3 id="subsection">Subsection</h3>'
        '<h2 id="second-section">Second Section</h2>'
        '</body></html>'
    )
    expected_block = (
        "## On This Page\n\n"
        "- [First Section](#first-section)\n"
        "  - [Subsection](#subsection)\n"
        "- [Second Section](#second-section)\n\n"
        "---\n"
    )

    try:
        with open(probe_md, "w") as f:
            f.write(md_content)
        with open(probe_html, "w") as f:
            f.write(html_content)

        # First run: should update
        s1, d1 = process_file(probe_rel, docs, dist, check_only=False)
        with open(probe_md) as f:
            written = f.read()
        if s1 != "updated":
            print(f"SELF-TEST FAILED: first run status={s1}, expected 'updated'")
            return 1
        if expected_block not in written:
            print("SELF-TEST FAILED: generated block does not match expected.")
            print(f"  expected:\n{expected_block}")
            print(f"  written:\n{written}")
            return 1

        # Second run: should be ok (no-op)
        s2, d2 = process_file(probe_rel, docs, dist, check_only=False)
        if s2 != "ok":
            print(f"SELF-TEST FAILED: second run status={s2}, expected 'ok' (idempotent)")
            return 1

        # Check mode on a clean file: should be ok
        s3, d3 = process_file(probe_rel, docs, dist, check_only=True)
        if s3 != "ok":
            print(f"SELF-TEST FAILED: check on clean file status={s3}, expected 'ok'")
            return 1

        print("SELF-TEST PASSED: generation correct, idempotent, check passes on clean file.")
        return 0
    finally:
        for p in (probe_md, probe_html):
            if os.path.exists(p):
                os.remove(p)


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("-")]
    flags = [a for a in argv[1:] if a.startswith("-")]
    repo_root = args[0] if args else _DEFAULT_REPO
    if "--selftest" in flags:
        return selftest(repo_root)
    check_only = "--check" in flags
    return run(repo_root, check_only=check_only)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
