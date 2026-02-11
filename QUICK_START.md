# Quick Start - Get Your Real Data

To see your actual teams (like Colonel Getafe) instead of the placeholder data, you have several options:

## Option 1: Run the Scraper Locally (May get 403 error)

```bash
cd scraper
pip install -r requirements.txt
python scrape.py
```

**Note:** If you get a `403 Forbidden` error, the site is blocking automated requests. Try Option 2 or 3.

## Option 2: Use Selenium Scraper (For JavaScript-rendered pages)

If the standard scraper fails, try the Selenium version:

```bash
cd scraper
pip install selenium beautifulsoup4
# Make sure ChromeDriver is installed: brew install chromedriver
python scrape_selenium.py
```

## Option 3: Manual Data Entry (Recommended if scraping fails)

Use the interactive helper script:

```bash
cd scraper
python manual_data_entry.py
```

This will guide you through entering your teams and fixtures step-by-step.

## Option 4: Edit JSON Directly

You can manually edit `data/results.json` with your real teams and fixtures.

The structure should be:
```json
{
  "league_name": "Players Lounge",
  "venue": "Islington Market Road",
  "last_updated": "2026-02-11 12:00:00",
  "teams": ["Colonel Getafe", "Team 2", "Team 3", ...],
  "gameweeks": [
    {
      "week": 1,
      "date": "2025-09-15",
      "fixtures": [
        {
          "home": "Colonel Getafe",
          "away": "Other Team",
          "home_score": 3,
          "away_score": 1
        }
      ]
    }
  ]
}
```

## Testing the Dashboard

After updating the data, open `index.html` in your browser or run:
```bash
python3 -m http.server 8000
# Then visit http://localhost:8000
```
