"""
Alternative scraper using Selenium for JavaScript-rendered pages.

This version uses Selenium WebDriver to handle sites that require JavaScript
or have anti-bot protection that blocks simple HTTP requests.

Install: pip install selenium beautifulsoup4
Requires: ChromeDriver or geckodriver (Firefox)
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

# Try to import selenium, fall back gracefully if not installed
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    print("⚠️  Selenium not installed. Install with: pip install selenium")


LEAGUE_URL = "https://www.playfootball.net/venues/islington-market-road/players-lounge/3359/15144/186"
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_FILE = DATA_DIR / "results.json"


def fetch_page_selenium(url: str) -> BeautifulSoup:
    """
    Fetch page using Selenium WebDriver (handles JavaScript).
    
    Args:
        url: The playfootball.net league URL
        
    Returns:
        BeautifulSoup object of the parsed HTML
    """
    if not SELENIUM_AVAILABLE:
        raise ImportError("Selenium is not installed. Run: pip install selenium")
    
    # Set up Chrome options
    chrome_options = ChromeOptions()
    chrome_options.add_argument("--headless")  # Run in background
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    try:
        # Try Chrome first
        driver = webdriver.Chrome(options=chrome_options)
    except Exception:
        try:
            # Fall back to Firefox
            from selenium.webdriver.firefox.options import Options as FirefoxOptions
            firefox_options = FirefoxOptions()
            firefox_options.add_argument("--headless")
            driver = webdriver.Firefox(options=firefox_options)
        except Exception as e:
            raise RuntimeError(f"Could not initialize WebDriver. Error: {e}")
    
    try:
        print(f"Loading page with Selenium...")
        driver.get(url)
        
        # Wait for page to load (adjust selector based on actual page)
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "table"))
            )
        except:
            # If no table found, just wait a bit for JS to render
            import time
            time.sleep(3)
        
        html = driver.page_source
        return BeautifulSoup(html, "lxml")
    finally:
        driver.quit()


# Import the extraction functions from the main scraper
# For now, we'll duplicate the key functions
def extract_teams(soup: BeautifulSoup) -> List[str]:
    """Extract team names from the league table."""
    teams = []
    
    # Look for "Colonel Getafe" or other team names
    # Try various selectors
    selectors = [
        "table tr td",
        ".team-name",
        "[class*='team']",
    ]
    
    for selector in selectors:
        elements = soup.select(selector)
        for elem in elements:
            text = elem.get_text(strip=True)
            # Look for team-like names (capitalized, reasonable length)
            if text and 3 <= len(text) <= 50 and text[0].isupper():
                if text not in teams and not any(char.isdigit() for char in text[:3]):
                    teams.append(text)
        if teams:
            break
    
    # Also search for "Colonel Getafe" specifically
    if "Colonel Getafe" in soup.get_text():
        if "Colonel Getafe" not in teams:
            teams.append("Colonel Getafe")
    
    # Look in tables more carefully
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows[1:]:  # Skip header
            cells = row.find_all(["td", "th"])
            for cell in cells:
                text = cell.get_text(strip=True)
                if text and 3 <= len(text) <= 50:
                    if text not in teams:
                        teams.append(text)
    
    return sorted(list(set(teams)))


def extract_fixtures(soup: BeautifulSoup, teams: List[str]) -> List[Dict]:
    """Extract match fixtures organized by gameweek."""
    gameweeks = []
    
    # Look for score patterns
    text = soup.get_text()
    score_pattern = re.compile(r"(\d+)\s*[-–]\s*(\d+)")
    
    # Find all score matches
    matches = list(score_pattern.finditer(text))
    
    if matches:
        # Group matches into potential fixtures
        current_week = 1
        week_fixtures = []
        
        for match in matches:
            home_score = int(match.group(1))
            away_score = int(match.group(2))
            
            # Try to find team names near the score
            start_pos = max(0, match.start() - 100)
            end_pos = min(len(text), match.end() + 100)
            context = text[start_pos:end_pos]
            
            # Find teams in context
            found_teams = [team for team in teams if team in context]
            
            if len(found_teams) >= 2:
                fixture = {
                    "home": found_teams[0],
                    "away": found_teams[1],
                    "home_score": home_score,
                    "away_score": away_score
                }
                week_fixtures.append(fixture)
        
        if week_fixtures:
            gameweeks.append({
                "week": current_week,
                "date": None,
                "fixtures": week_fixtures
            })
    
    return gameweeks


def scrape_league() -> Dict:
    """Main scraping function using Selenium."""
    print(f"Fetching data from {LEAGUE_URL} using Selenium...")
    soup = fetch_page_selenium(LEAGUE_URL)
    
    print("Extracting teams...")
    teams = extract_teams(soup)
    print(f"Found {len(teams)} teams: {', '.join(teams)}")
    
    print("Extracting fixtures...")
    gameweeks = extract_fixtures(soup, teams)
    print(f"Found {len(gameweeks)} gameweeks with {sum(len(gw['fixtures']) for gw in gameweeks)} total fixtures")
    
    result = {
        "league_name": "Players Lounge",
        "venue": "Islington Market Road",
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "teams": teams,
        "gameweeks": gameweeks
    }
    
    return result


def save_data(data: Dict) -> None:
    """Save scraped data to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Data saved to {DATA_FILE}")


def main():
    """Main entry point."""
    try:
        data = scrape_league()
        save_data(data)
        print("Scraping completed successfully!")
    except Exception as e:
        print(f"Error during scraping: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
