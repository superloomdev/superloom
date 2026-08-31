#!/usr/bin/env python3
"""Anchor link audit - validates markdown anchor links against built HTML ids.

This script is SITE-ONLY by construction. It harvests actual heading ids from
`website/DIST/**/*.html` (the ground truth) and checks every `[txt](path#anchor)`
and `[txt](#anchor)` link in `docs/**/*.md` against them. A clean run certifies
the built website and says nothing about GitHub, whose slugifier differs.

VitePress does not validate heading fragments. `ignoreDeadLinks: []` being strict
is not evidence that anchors are sound. That misreading is what let 82 findings
sit behind a green build for months.

Usage:
  anchor-audit.py [REPO_ROOT]          Audit and exit non-zero on any finding.
  anchor-audit.py [REPO_ROOT] --selftest   Run the self-test (probe file).

REPO_ROOT defaults to the codebase-superloom directory (sibling of __dev__).
"""
import re, os, glob, sys
from collections import defaultdict

# ---- Locate the repo root ----
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_REPO = os.path.normpath(os.path.join(_SCRIPT_DIR, "..", ".."))


def _paths(repo_root):
    return (
        os.path.join(repo_root, "docs"),
        os.path.join(repo_root, "website", "DIST"),
    )


# ---- GitHub slugifier (for divergence diagnosis only) ----
def gh_slug(text):
    t = text.strip()
    t = re.sub(r'`([^`]*)`', r'\1', t)
    t = re.sub(r'\*\*([^*]*)\*\*', r'\1', t)
    t = re.sub(r'\*([^*]*)\*', r'\1', t)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = t.lower()
    t = re.sub(r'[^\w\s-]', '', t, flags=re.UNICODE)
    t = t.replace(' ', '-')
    return t


def _harvest_html_ids(dist):
    """relpath(no ext) -> set of ids, from built HTML."""
    html_ids = {}
    for html in glob.glob(os.path.join(dist, "**", "*.html"), recursive=True):
        rel = os.path.relpath(html, dist)
        key = rel[:-5]  # strip .html
        with open(html, encoding="utf-8", errors="replace") as f:
            content = f.read()
        ids = set(re.findall(r'<h[1-6][^>]*\sid="([^"]+)"', content))
        html_ids[key] = ids
    return html_ids


def _harvest_doc_headings(docs):
    """repo-relative path (with docs/ prefix) -> list of (level, raw_text).

    The docs/ prefix is kept so keys match the built HTML structure under
    DIST/docs/... (docs are synced to website/docs/ before building).
    """
    repo = os.path.dirname(docs)  # repo root
    doc_headings = {}
    for md in glob.glob(os.path.join(docs, "**", "*.md"), recursive=True):
        rel = os.path.relpath(md, repo)
        with open(md, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        hs = []
        in_fence = False
        for ln in lines:
            if ln.strip().startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            m = re.match(r'^(#{1,6})\s+(.*?)\s*$', ln)
            if m:
                hs.append((len(m.group(1)), m.group(2)))
        doc_headings[rel] = hs
    return doc_headings


# ---- Link harvester ----
_LINK_RE = re.compile(r'\[([^\]]*)\]\(([^)\s]*?)#([^)\s]+)\)')


def _harvest_links(docs):
    """Yield (rel, lineno, path, anchor) for every anchor link outside fences.

    rel is repo-relative (with docs/ prefix) to match built HTML keys.
    """
    repo = os.path.dirname(docs)
    for md in glob.glob(os.path.join(docs, "**", "*.md"), recursive=True):
        rel = os.path.relpath(md, repo)
        with open(md, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        in_fence = False
        for i, ln in enumerate(lines, 1):
            if ln.strip().startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            for m in _LINK_RE.finditer(ln):
                yield rel, i, m.group(2), m.group(3)


def audit(docs, dist):
    """Run the audit. Returns (broken, notbuilt, doc_count)."""
    html_ids = _harvest_html_ids(dist)
    doc_headings = _harvest_doc_headings(docs)

    broken = []
    notbuilt = []
    for rel, lineno, path, anchor in _harvest_links(docs):
        if path == "":
            target = rel
        else:
            if not path.endswith(".md"):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(rel), path))
        key = target[:-3] if target.endswith(".md") else target
        ids = html_ids.get(key)
        if ids is None:
            alt = os.path.join(key, "index")
            ids = html_ids.get(alt)
        if ids is None:
            notbuilt.append((rel, lineno, path, anchor))
            continue
        if anchor in ids:
            continue
        cand = ""
        for _lvl, htext in doc_headings.get(target, []):
            if gh_slug(htext) == anchor:
                cand = htext
                break
        broken.append((rel, lineno, path, anchor, cand))

    return broken, notbuilt, len(doc_headings)


def _classify(anchor, heading):
    if not heading:
        return "no-matching-heading (stale or renamed)"
    if re.search(r'[`]', heading):
        return "heading contains backticks/code"
    if re.search(r'[^\w\s-]', heading):
        chars = "".join(sorted(set(re.findall(r'[^\w\s-]', heading))))
        return f"heading contains punctuation: {chars!r}"
    return "other divergence"


def run(repo_root):
    docs, dist = _paths(repo_root)
    if not os.path.isdir(dist):
        print(f"ERROR: built HTML not found at {dist}. Run the website build first.")
        return 2
    if not os.path.isdir(docs):
        print(f"ERROR: docs directory not found at {docs}.")
        return 2

    broken, notbuilt, doc_count = audit(docs, dist)

    print(f"Docs files scanned: {doc_count}")
    print(f"Broken anchors: {len(broken)}")
    print(f"Target page not built: {len(notbuilt)}")

    if broken:
        print("\n=== BROKEN BY CAUSE ===")
        buckets = defaultdict(list)
        for rel, i, path, anchor, cand in broken:
            buckets[_classify(anchor, cand)].append((rel, i, anchor, cand))
        for cause, items in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
            print(f"\n[{len(items)}] {cause}")
            for rel, i, anchor, cand in items[:8]:
                print(f"    {rel}:{i}  #{anchor}")
                if cand:
                    print(f"        heading: {cand!r}")
            if len(items) > 8:
                print(f"    ... and {len(items)-8} more")

    if notbuilt:
        print("\n=== TARGET PAGE NOT BUILT (sample) ===")
        for rel, i, path, anchor in notbuilt[:10]:
            print(f"    {rel}:{i} -> {path}#{anchor}")

    if broken or notbuilt:
        return 1
    return 0


def selftest(repo_root):
    """Plant a probe file with one known-broken and one known-good anchor.

    The probe needs a built HTML target. We reuse an existing docs file's HTML
    by creating the probe in the same directory and building a minimal HTML in
    DIST. Simpler: create the probe as a docs file whose links point to itself,
    and create a matching HTML with known ids.
    """
    docs, dist = _paths(repo_root)
    repo = os.path.dirname(docs)
    probe_rel = "docs/_selftest_probe.md"  # repo-relative, matches HTML key
    probe_md = os.path.join(repo, probe_rel)
    probe_html = os.path.join(dist, probe_rel[:-3] + ".html")

    # HTML with one known id; the good anchor matches, the bad does not.
    html_content = '<html><body><h2 id="real-heading">Real Heading</h2></body></html>'
    md_content = (
        "# Probe\n\n"
        "## On This Page\n\n"
        "- [Good](#real-heading)\n"
        "- [Bad](#nonexistent-heading)\n"
    )

    try:
        with open(probe_html, "w") as f:
            f.write(html_content)
        with open(probe_md, "w") as f:
            f.write(md_content)

        broken, notbuilt, _ = audit(docs, dist)
        # Filter to only the probe's findings
        probe_broken = [b for b in broken if b[0] == probe_rel]
        probe_notbuilt = [b for b in notbuilt if b[0] == probe_rel]

        ok = (
            len(probe_broken) == 1
            and probe_broken[0][3] == "nonexistent-heading"
            and len(probe_notbuilt) == 0
        )
        if ok:
            print("SELF-TEST PASSED: exactly one broken anchor found in probe.")
            return 0
        else:
            print(f"SELF-TEST FAILED: probe_broken={probe_broken} probe_notbuilt={probe_notbuilt}")
            return 1
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
    return run(repo_root)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
