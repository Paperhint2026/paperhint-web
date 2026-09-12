#!/usr/bin/env python3
"""Render docs/modules/*.md into docs/product-scheme.html between the
<!-- modules:start --> / <!-- modules:end --> markers. Minimal markdown:
# title · ## heading · paragraphs · - / 1. lists · **bold** · `code` · *em*."""
import html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = sorted((ROOT / "docs/modules").glob("*.md"))
PAGE = ROOT / "docs/product-scheme.html"

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![*\w])\*([^*]+)\*(?!\w)", r"<em>\1</em>", s)
    s = s.replace("→", "→").replace(" · ", " · ")
    return s

def render(md):
    lines = md.splitlines()
    title = lines[0].lstrip("# ").strip()
    out, buf, mode = [], [], None
    def flush():
        nonlocal buf, mode
        if not buf: return
        if mode == "p": out.append("<p>" + inline(" ".join(buf)) + "</p>")
        elif mode == "ul": out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in buf) + "</ul>")
        elif mode == "ol": out.append("<ol>" + "".join(f"<li>{inline(x)}</li>" for x in buf) + "</ol>")
        buf, mode = [], None
    for ln in lines[1:]:
        s = ln.rstrip()
        if not s: flush(); continue
        if s.startswith("## "): flush(); out.append(f"<h4>{inline(s[3:])}</h4>"); continue
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)", s)
        if m:
            kind = "ol" if m.group(2)[0].isdigit() else "ul"
            if m.group(1) and buf:  # continuation of a wrapped list item
                buf[-1] += " " + m.group(3); continue
            if mode != kind: flush(); mode = kind
            buf.append(m.group(3)); continue
        if mode in ("ul", "ol") and s.startswith("  "):
            buf[-1] += " " + s.strip(); continue
        if mode != "p": flush(); mode = "p"
        buf.append(s.strip())
    flush()
    return title, "\n".join(out)

blocks = []
for i, f in enumerate(DOCS):
    title, body = render(f.read_text())
    num, _, name = title.partition(" · ")
    if not _:
        num, name = f.stem.split("-", 1)[0], title
    open_attr = " open" if i in (0, 1) else ""
    blocks.append(f'''<details class="doc"{open_attr} id="doc-{f.stem}">
  <summary><span class="no">{html.escape(num.strip())}</span><span class="t">{inline(name.strip())}</span><span class="src">{f.name}</span></summary>
  <div class="body">{body}</div>
</details>''')

section = "<!-- modules:start -->\n" + "\n".join(blocks) + "\n<!-- modules:end -->"
page = PAGE.read_text()
page = re.sub(r"<!-- modules:start -->.*?<!-- modules:end -->", lambda m: section, page, flags=re.S)
PAGE.write_text(page)
print(f"rendered {len(DOCS)} documents into {PAGE.name}")
