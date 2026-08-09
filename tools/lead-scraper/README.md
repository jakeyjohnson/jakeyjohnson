# Lead scraper (Scrapegraph-AI)

Internal tool for pulling contact/marketing leads from potential sponsor,
venue and partner websites. Not part of the deployed site — lives here for
local/CI use only.

`Scrapegraph-ai/` is a git submodule of the upstream
[ScrapeGraphAI/Scrapegraph-ai](https://github.com/ScrapeGraphAI/Scrapegraph-ai)
repo, kept for reference/examples. The actual tool runs on the `scrapegraphai`
PyPI package, pinned in `requirements.txt`.

## Setup

```bash
cd tools/lead-scraper
git submodule update --init Scrapegraph-ai   # only needed once, for the reference copy
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium   # only needed if a target site requires JS rendering
```

`requirements.txt` pins `langchain-community==0.4.1` — scrapegraphai 1.76.0
breaks on `langchain-community` 0.4.2+ (`ChatOllama` was removed from
`langchain_community.chat_models`), so don't let this float.

## Usage

1. Set an LLM API key (OpenAI by default):
   ```bash
   export OPENAI_API_KEY=sk-...
   ```
2. Add target URLs (one per line) to `urls.txt`.
3. Run:
   ```bash
   python scrape_leads.py --urls urls.txt --output leads.csv
   ```

Output is a CSV with `organisation_name`, `category` (sponsor/venue/partner),
`contact_email`, `contact_phone`, `address`, `website`, `social_links`, and a
short fit `notes` field per URL.

## Notes

- Only scrape sites you have the right to scrape — check each target's
  robots.txt / terms of service before adding it to `urls.txt`.
- `leads.csv` and `.venv/` are gitignored; treat scraped output as local data,
  not something to commit.
