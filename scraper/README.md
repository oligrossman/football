# Scraper Documentation

## Problem: 403 Forbidden Error

If you're getting a `403 Client Error: Forbidden`, the website is blocking automated requests. This is common with modern websites that have anti-bot protection.

## Solutions

### Option 1: Use Selenium (Recommended for JavaScript-rendered pages)

If the page requires JavaScript to load content:

```bash
pip install selenium beautifulsoup4
python scrape_selenium.py
```

**Note:** You'll need ChromeDriver or geckodriver installed:
- macOS: `brew install chromedriver`
- Or download from: https://chromedriver.chromium.org/

### Option 2: Manual Data Entry

If scraping continues to fail, you can manually edit `data/results.json`:

1. Open the playfootball.net page in your browser
2. Copy the team names and fixture data
3. Edit `data/results.json` with the correct structure

### Option 3: Browser Extension/Manual Export

1. Use a browser extension to export the page data
2. Or copy/paste the HTML and save it locally
3. Modify the scraper to read from the local HTML file

## Testing Locally

```bash
cd scraper
pip install -r requirements.txt
python scrape.py
```

If it fails with 403, try:
```bash
pip install selenium
python scrape_selenium.py
```

## GitHub Actions

The GitHub Actions workflow will attempt to scrape, but if it gets 403 errors, you may need to:
1. Use Selenium in the workflow (requires setting up ChromeDriver)
2. Manually update the data file
3. Use a different approach (API if available, or scheduled manual updates)
