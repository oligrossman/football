# Football League Dashboard

Interactive dashboard for tracking league standings and match results over the season.

## Features

- **Cumulative Points Chart**: Interactive Plotly.js chart showing each team's points progression
  - Hover over data points to see fixture details
  - Click any team line to highlight it and dim others
  - Tooltips show match results for each gameweek
  
- **Gameweek Fixtures Table**: Detailed table showing all fixtures for a selected gameweek
  - Updates automatically when hovering/clicking on chart points
  - Shows scores and points awarded per team
  - Highlights rows containing the selected team

- **Manual Data Updates**: Data is maintained in `data/results.json`
  - Update the file with new fixtures as the season progresses
  - The dashboard automatically reflects the latest data

## Setup

### Local Development

1. Install Python dependencies:
```bash
cd scraper
pip install -r requirements.txt
```

2. Run the scraper manually:
```bash
python scraper/scrape.py
```

3. Open `index.html` in a web browser (or use a local server):
```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

### GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to Settings > Pages
3. Select source: "Deploy from a branch"
4. Select branch: `main` and folder: `/ (root)`
5. Your dashboard will be live at `https://<username>.github.io/football/`

### Updating Data

Since the playfootball.net site blocks automated scraping (403 Forbidden), data is maintained manually:

1. Get the latest results from the playfootball.net website
2. Edit `data/results.json` with the new fixtures
3. Follow the existing JSON structure (see Data Format section below)
4. Commit and push to update the dashboard

The dashboard will automatically show the updated data once the file is updated.

## Data Format

The dashboard reads from `data/results.json` with the following structure:

```json
{
  "league_name": "Players Lounge",
  "venue": "Islington Market Road",
  "last_updated": "2026-02-11 12:00:00",
  "teams": ["Team A", "Team B", ...],
  "gameweeks": [
    {
      "week": 1,
      "date": "2025-09-15",
      "fixtures": [
        {
          "home": "Team A",
          "away": "Team B",
          "home_score": 3,
          "away_score": 1
        }
      ]
    }
  ]
}
```

## Scoring System

- Win: 3 points
- Draw: 1 point
- Loss: 0 points

This can be adjusted in `js/dashboard.js` in the `getPointsForResult()` function.

## Project Structure

```
football/
  .github/workflows/scrape.yml   # Automated scraping workflow
  scraper/
    scrape.py                     # Web scraper
    requirements.txt              # Python dependencies
  data/
    results.json                  # League data (auto-updated)
  index.html                     # Main dashboard page
  css/style.css                  # Styling
  js/dashboard.js                # Dashboard logic
```

## Notes

- The scraper may need adjustment if playfootball.net changes their HTML structure
- If scraping fails, you can manually edit `data/results.json` - the frontend only depends on this file
- The dashboard works entirely client-side - no backend required for GitHub Pages
