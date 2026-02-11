# Quick Start - Get Your Real Data

To see your actual teams (like Colonel Getafe) instead of the placeholder data, run the scraper:

## Option 1: Run the Scraper Locally

```bash
cd scraper
pip install -r requirements.txt
python scrape.py
```

This will fetch the real data from playfootball.net and update `data/results.json`.

## Option 2: Manual Data Entry (if scraper needs adjustment)

If the scraper doesn't work immediately (the page structure may need inspection), you can manually edit `data/results.json` with your real teams and fixtures.

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
