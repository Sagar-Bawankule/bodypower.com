"""
BodyPower.com — static build script (Python 3 standard library only).

    python build.py            -> builds ./dist
    python build.py --serve    -> builds, then serves ./dist on http://localhost:8008

Pages live in src/pages/*.html. Each page starts with a meta block:

    <!--meta
    title: Page title
    description: Meta description
    path: /games/
    nav: games
    robots: index,follow
    -->

Shared chrome lives in src/partials/. Edit CONFIG below to supply confirmed
URLs. Anything left as None renders a safe fallback instead of a guessed URL.
"""

import json
import os
import re
import shutil
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# CONFIG — values BodyPower must confirm before launch (brief §14)
# --------------------------------------------------------------------------
CONFIG = {
    # Used for canonical URLs, sitemap and social previews. Override per environment with
    # the SITE_URL env var (e.g. on a Vercel test deployment).
    "site_url": os.environ.get("SITE_URL", "https://www.bodypower.com").rstrip("/"),
    # Final Games ticketing URL. None = buttons point to /games/#tickets
    # (brief §6.1: "Do not guess or publish an unverified URL").
    # Verified 2026-11-06: Ticket Tailor event 2207403 = "BODYPOWER GAMES 2027 – ExCeL London"
    # (the same event the old site's TTWidget buttons load).
    "ticket_url": "https://tickets.bodypower.com/events/bodypower/2207403",
    # Ticket Tailor checkout pop-up (same widget the old site used). When set, every
    # ticket button opens the "Select tickets" checkout over the page; ticket_url
    # remains the no-JS / failure fallback. Set to None to use plain links.
    "ticket_widget": {"box_office": "bodypower", "event_id": "2207403", "domain": "tickets.bodypower.com"},
    # Existing GTM container from the old site. Only loaded after analytics consent.
    "gtm_id": "GTM-KFL3CRQQ",
    # Lowest current ticket price, shown on the mobile ticket bar. Update when the Early Bird ends.
    "ticket_from": "£29",
    # Published on the old site (/pharmacy/). Confirm it is the right general inbox.
    "contact_email": "hello@bodypower.com",
    "transform_url": "https://bodypowertransform.com",
    "community_url": "https://bodypower-transform.discourse.group",
    # Partnership form endpoint (CRM / form handler). None = demo mode.
    "form_endpoint": None,
    # Official social profiles. Only non-empty entries are rendered.
    "socials": {
        "Instagram": None,
        "YouTube": None,
        "Facebook": None,
        "TikTok": None,
        "X": None,
    },
    # Pages whose meta block says "draft: true" are not built unless this is True.
    # Use it for pages that must stay unpublished until management approves them.
    "include_drafts": False,
    # True  = reviewer view: empty photo slots show their "PHOTO SLOT" briefs and
    #         pending items show loud yellow "Pending" tags.
    # False = presentation view: empty slots show a subtle branded fill and
    #         pending items are quiet grey notes. Use for client demos / launch.
    "review_mode": False,
}

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

ICONS = {
    "ARROW": '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    "EXT": '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    "NEWTAB": '<span class="sr-only"> (opens in a new tab)</span>',
}


def ext_attrs(url, track):
    return f'href="{url}" target="_blank" rel="noopener" data-track="{track}"'


def tokens():
    t = dict(ICONS)
    tw = CONFIG.get("ticket_widget")
    if CONFIG["ticket_url"] and tw:
        # opens the Ticket Tailor checkout dialog on the page; href is the fallback
        t["TICKET_ATTRS"] = (f'href="{CONFIG["ticket_url"]}" data-track="ticket_click" data-ticket-widget '
                             'aria-haspopup="dialog"')
        t["TICKET_NOTE"] = ""
        t["TICKET_ICON"] = ICONS["ARROW"]
        t["TICKET_WIDGET"] = f'{tw["box_office"]}|{tw["event_id"]}|{tw["domain"]}'
    elif CONFIG["ticket_url"]:
        t["TICKET_ATTRS"] = ext_attrs(CONFIG["ticket_url"], "ticket_click")
        t["TICKET_NOTE"] = ICONS["NEWTAB"]
        t["TICKET_ICON"] = ICONS["EXT"]
        t["TICKET_WIDGET"] = ""
    else:
        t["TICKET_ATTRS"] = 'href="/games/#tickets" data-track="ticket_click_pending"'
        t["TICKET_NOTE"] = ""
        t["TICKET_ICON"] = ICONS["ARROW"]
        t["TICKET_WIDGET"] = ""
    t["TRANSFORM_ATTRS"] = ext_attrs(CONFIG["transform_url"], "transform_click")
    t["COMMUNITY_ATTRS"] = ext_attrs(CONFIG["community_url"], "community_click")
    t["FORM_ENDPOINT"] = CONFIG["form_endpoint"] or ""
    t["GTM_ID"] = CONFIG["gtm_id"] or ""
    t["TICKET_FROM"] = CONFIG["ticket_from"]
    t["MODE"] = "review" if CONFIG["review_mode"] else "present"
    # reusable content partials, referenced in pages as {{TF_PANEL}} etc.
    for name in ("TF_PANEL", "TICKER", "SPEAKERS"):
        t[name] = (SRC / "partials" / (name.lower().replace("_", "-") + ".html")).read_text(encoding="utf-8").strip()
    t["CONTACT_EMAIL"] = CONFIG["contact_email"] or ""
    socials = [(n, u) for n, u in CONFIG["socials"].items() if u]
    if socials:
        t["SOCIALS"] = "".join(
            f'<li><a {ext_attrs(u, "social_click")}>{n}{ICONS["NEWTAB"]}</a></li>'
            for n, u in socials
        )
    else:
        t["SOCIALS"] = '<li><span class="tbc">Official profile links pending</span></li>'
    return t


META_RE = re.compile(r"<!--meta\s*(.*?)-->", re.S)


def parse_page(text):
    m = META_RE.search(text)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text.strip()


def render(template, values):
    return re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: values.get(m.group(1), m.group(0)), template)


def main():
    # Empty dist/ rather than deleting it, so a running preview server
    # (which holds the folder open on Windows) doesn't block the build.
    DIST.mkdir(exist_ok=True)
    for child in DIST.iterdir():
        shutil.rmtree(child) if child.is_dir() else child.unlink()
    shutil.copytree(SRC / "assets", DIST / "assets")
    shutil.copy(SRC / "assets" / "favicon.svg", DIST / "favicon.svg")

    layout = (SRC / "partials" / "layout.html").read_text(encoding="utf-8")
    header = (SRC / "partials" / "header.html").read_text(encoding="utf-8")
    footer = (SRC / "partials" / "footer.html").read_text(encoding="utf-8")
    tok = tokens()

    org = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "BodyPower",
        "url": CONFIG["site_url"],
        "foundingDate": "2008",
        "slogan": "Built on heritage. Powered by the future.",
    }

    sitemap = []
    built = []
    for page in sorted((SRC / "pages").glob("*.html")):
        meta, body = parse_page(page.read_text(encoding="utf-8"))
        path = meta.get("path", "/")
        if meta.get("draft", "").lower() == "true" and not CONFIG["include_drafts"]:
            print(f"  skipped  {path}  (draft page)")
            continue
        robots = meta.get("robots", "index,follow")
        nav = meta.get("nav", "")

        page_header = header
        if nav:
            page_header = page_header.replace(f'data-nav="{nav}"', f'data-nav="{nav}" aria-current="page"')

        html = render(layout, {
            "TITLE": meta.get("title", "BodyPower"),
            "DESCRIPTION": meta.get("description", ""),
            "CANONICAL": CONFIG["site_url"] + path,
            "ROBOTS": robots,
            "PAGE": nav or "page",
            "JSONLD": json.dumps(org),
            "HEADER": page_header,
            "CONTENT": body,
            "FOOTER": footer,
        })
        html = render(render(html, tok), tok)  # tokens inside content, then tokens inside partials

        out = DIST / path.strip("/") / "index.html" if path != "/404/" else DIST / "404.html"
        if path == "/":
            out = DIST / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        built.append(path)
        if "noindex" not in robots and path != "/404/":
            sitemap.append(CONFIG["site_url"] + path)
        print(f"  built    {path}")

    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in sitemap)
        + "</urlset>\n",
        encoding="utf-8",
    )
    (DIST / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {CONFIG['site_url']}/sitemap.xml\n", encoding="utf-8"
    )
    print(f"Done: {len(built)} pages -> {DIST}")


if __name__ == "__main__":
    main()
    if "--serve" in sys.argv:
        import functools
        import http.server

        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
        print("Serving on http://localhost:8008  (Ctrl+C to stop)")
        http.server.ThreadingHTTPServer(("127.0.0.1", 8008), handler).serve_forever()
