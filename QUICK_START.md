# Quick Start

## View Your Dashboard

The dashboard is ready to use! All your real data (including Colonel Getafe) is already loaded in `data/results.json`.

**To view the dashboard:**

1. Open `index.html` in your web browser, or
2. Run a local server:
   ```bash
   python3 -m http.server 8000
   # Then visit http://localhost:8000
   ```

## Updating Data (For Future Gameweeks)

Since automated scraping doesn't work (site blocks it), update data manually:

1. Get the latest results from playfootball.net
2. Edit `data/results.json` 
3. Add new gameweek entries following the existing format:
   ```json
   {
     "week": 22,
     "date": "2026-02-16",
     "fixtures": [
       {
         "home": "Team A",
         "away": "Team B",
         "home_score": 3,
         "away_score": 1
       }
     ]
   }
   ```
4. Save and commit - the dashboard will automatically update!

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
