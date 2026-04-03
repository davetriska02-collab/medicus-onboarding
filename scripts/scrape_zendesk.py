#!/usr/bin/env python3
"""
Scrape the Medicus Zendesk help centre for new and updated articles.

Compares against data/articles.json and writes the full article corpus
(including bodies) back to data/articles.json if anything changed.

Run standalone:  python scripts/scrape_zendesk.py
Outputs:         data/articles.json   (updated with latest content)
                 data/articles.json.changed  (empty file written if changes detected)
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing deps. Run: pip install requests beautifulsoup4")
    sys.exit(1)

ZENDESK_BASE = "https://medicus-health.zendesk.com"
API_BASE     = f"{ZENDESK_BASE}/api/v2/help_center/en-gb"
LOCALE       = "en-gb"

ROOT         = Path(__file__).parent.parent
OUT_FILE     = ROOT / "data" / "articles.json"
CHANGED_FLAG = ROOT / "data" / "articles.json.changed"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "MedicusOnboardingRefresh/1.0"})


def fetch_all_articles():
    """Paginate through Zendesk API to get all articles."""
    articles = []
    url = f"{API_BASE}/articles.json?per_page=100&sort_by=updated_at&sort_order=desc"
    while url:
        resp = SESSION.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        articles.extend(data.get("articles", []))
        url = data.get("next_page")
        time.sleep(0.3)  # be polite
    return articles


def fetch_section_name(section_id, cache={}):
    if section_id in cache:
        return cache[section_id]
    try:
        resp = SESSION.get(f"{API_BASE}/sections/{section_id}.json", timeout=15)
        resp.raise_for_status()
        name = resp.json()["section"]["name"]
    except Exception:
        name = f"Section {section_id}"
    cache[section_id] = name
    return name


def extract_body(html_body):
    """Strip HTML tags from Zendesk article body."""
    if not html_body:
        return ""
    soup = BeautifulSoup(html_body, "html.parser")
    # Remove script/style
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text(separator="\n").strip()


def main():
    print("Fetching articles from Zendesk API...")
    raw = fetch_all_articles()
    print(f"  {len(raw)} articles fetched.")

    # Load existing articles for comparison
    existing = []
    existing_map = {}
    if OUT_FILE.exists():
        with open(OUT_FILE, encoding="utf-8") as f:
            existing = json.load(f)
        existing_map = {a["id"]: a for a in existing}
        print(f"  {len(existing)} articles currently on disk.")

    new_articles = []
    changed = False

    for raw_art in raw:
        art_id = raw_art["id"]
        updated_at = raw_art.get("updated_at", "")
        title = raw_art.get("title", "")
        section_id = raw_art.get("section_id")
        url = raw_art.get("html_url", "")

        # Check if this article is new or updated
        existing_art = existing_map.get(art_id)
        if existing_art and existing_art.get("updated_at") == updated_at:
            # No change - keep existing (includes body)
            new_articles.append(existing_art)
            continue

        # New or changed - fetch full body and section name
        print(f"  {'NEW' if not existing_art else 'UPDATED'}: {title[:60]}")
        section = fetch_section_name(section_id) if section_id else "General"
        body = extract_body(raw_art.get("body", ""))

        article = {
            "id":         art_id,
            "title":      title,
            "section":    section,
            "url":        url,
            "updated_at": updated_at,
            "body":       body,
            "roles":      existing_art.get("roles", ["Administrator"]) if existing_art else ["Administrator"],
        }
        new_articles.append(article)
        changed = True
        time.sleep(0.1)

    # Check for deleted articles
    new_ids = {a["id"] for a in raw}
    for art in existing:
        if art["id"] not in new_ids:
            print(f"  REMOVED: {art['title'][:60]}")
            changed = True

    if changed:
        with open(OUT_FILE, "w", encoding="utf-8") as f:
            json.dump(new_articles, f, ensure_ascii=False, indent=2)
        print(f"  Saved {len(new_articles)} articles to {OUT_FILE}")
        # Write flag file so build_data.py knows to re-run
        CHANGED_FLAG.write_text("1")
    else:
        print("  No changes detected. Skipping save.")
        # Ensure no stale flag
        if CHANGED_FLAG.exists():
            CHANGED_FLAG.unlink()


if __name__ == "__main__":
    main()
