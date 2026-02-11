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

- **Automated Updates**: GitHub Actions workflow scrapes data weekly from playfootball.net
  - Runs every Monday at 9 AM UTC
  - Can be triggered manually via GitHub Actions UI
  - Automatically commits updated data to the repository

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

### Automated Scraping

The GitHub Actions workflow will automatically:
- Run every Monday at 9 AM UTC
- Scrape the latest data from playfootball.net
- Commit updated `data/results.json` to the repository
- GitHub Pages will automatically update with the new data

To trigger manually:
- Go to Actions tab in GitHub
- Select "Scrape League Data" workflow
- Click "Run workflow"

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
