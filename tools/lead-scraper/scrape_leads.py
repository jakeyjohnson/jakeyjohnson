#!/usr/bin/env python3
"""
Lead scraper for potential sponsors, venues and partners, built on Scrapegraph-AI.

Usage:
    source .venv/bin/activate
    export OPENAI_API_KEY=sk-...
    python scrape_leads.py --urls urls.txt --output leads.csv
"""

import argparse
import csv
import json
import os
import sys

from scrapegraphai.graphs import SmartScraperGraph

EXTRACTION_PROMPT = """
Extract marketing lead information from this page for a padel/sports event
company evaluating potential sponsors, venues and partners. Return:
- organisation_name
- category (sponsor, venue, partner, or unknown)
- contact_email
- contact_phone
- address
- website
- social_links (list)
- notes (why this org could be a good sponsor/venue/partner fit, one sentence)
If a field isn't found, leave it as an empty string.
"""

FIELDNAMES = [
    "source_url",
    "organisation_name",
    "category",
    "contact_email",
    "contact_phone",
    "address",
    "website",
    "social_links",
    "notes",
]


def build_config(model: str) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("Set OPENAI_API_KEY (or edit build_config() for a different LLM provider) before running.")
    return {
        "llm": {
            "api_key": api_key,
            "model": model,
        },
        "verbose": False,
        "headless": True,
    }


def scrape_url(url: str, config: dict) -> dict:
    graph = SmartScraperGraph(prompt=EXTRACTION_PROMPT, source=url, config=config)
    result = graph.run()
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except json.JSONDecodeError:
            result = {"notes": result}
    row = {field: "" for field in FIELDNAMES}
    row["source_url"] = url
    for key, value in (result or {}).items():
        if key in row:
            row[key] = ", ".join(value) if isinstance(value, list) else value
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--urls", required=True, help="Text file with one target URL per line")
    parser.add_argument("--output", default="leads.csv", help="CSV file to write results to")
    parser.add_argument("--model", default="openai/gpt-4o-mini", help="LLM model for scrapegraphai")
    args = parser.parse_args()

    with open(args.urls) as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    if not urls:
        sys.exit(f"No URLs found in {args.urls}")

    config = build_config(args.model)

    with open(args.output, "w", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=FIELDNAMES)
        writer.writeheader()
        for url in urls:
            print(f"Scraping {url} ...")
            try:
                row = scrape_url(url, config)
            except Exception as exc:
                print(f"  failed: {exc}", file=sys.stderr)
                row = {field: "" for field in FIELDNAMES}
                row["source_url"] = url
                row["notes"] = f"ERROR: {exc}"
            writer.writerow(row)

    print(f"Wrote {len(urls)} rows to {args.output}")


if __name__ == "__main__":
    main()
