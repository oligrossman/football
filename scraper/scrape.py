"""
Scraper for playfootball.net league results.

This script fetches league data from playfootball.net and extracts:
- Team names
- Match fixtures with scores per gameweek
- Dates for each gameweek

Outputs structured JSON to data/results.json
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup


LEAGUE_URL = "https://www.playfootball.net/venues/islington-market-road/players-lounge/3359/15144/186"
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_FILE = DATA_DIR / "results.json"


def fetch_page(url: str) -> BeautifulSoup:
    """
    Fetch and parse the league page HTML.
    
    Args:
        url: The playfootball.net league URL
        
    Returns:
        BeautifulSoup object of the parsed HTML
        
    Raises:
        requests.RequestException: If the request fails
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return BeautifulSoup(response.content, "lxml")


def extract_teams(soup: BeautifulSoup) -> List[str]:
    """
    Extract team names from the league table.
    
    Args:
        soup: Parsed HTML soup
        
    Returns:
        List of team names (sorted alphabetically for consistency)
    """
    teams = []
    
    # Try multiple selectors - will need to inspect actual page structure
    # Common patterns: table rows, divs with team names, etc.
    selectors = [
        "table.league-table tr td:first-child",
        "table tr td.team-name",
        ".team-name",
        "table.standings tr td:nth-of-type(2)",  # Usually team name is 2nd column
    ]
    
    for selector in selectors:
        elements = soup.select(selector)
        if elements:
            for elem in elements:
                team_name = elem.get_text(strip=True)
                if team_name and team_name not in teams and len(team_name) > 1:
                    teams.append(team_name)
            if teams:
                break
    
    # Fallback: look for any table rows that might contain team names
    if not teams:
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")[1:]  # Skip header
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) >= 2:
                    potential_team = cells[1].get_text(strip=True)
                    if potential_team and len(potential_team) > 1:
                        if potential_team not in teams:
                            teams.append(potential_team)
    
    return sorted(list(set(teams))) if teams else []


def extract_fixtures(soup: BeautifulSoup, teams: List[str]) -> List[Dict]:
    """
    Extract match fixtures organized by gameweek.
    
    Args:
        soup: Parsed HTML soup
        teams: List of team names (for validation)
        
    Returns:
        List of gameweek dictionaries, each containing fixtures
    """
    gameweeks = []
    
    # Try to find fixtures organized by gameweek/round
    # Common patterns: sections per gameweek, tables per round, etc.
    
    # Pattern 1: Look for sections/divs with gameweek indicators
    gameweek_sections = soup.find_all(["section", "div"], class_=re.compile(r"gameweek|round|week|fixture", re.I))
    
    if gameweek_sections:
        for idx, section in enumerate(gameweek_sections, 1):
            fixtures = extract_fixtures_from_section(section, teams)
            if fixtures:
                gameweeks.append({
                    "week": idx,
                    "date": None,  # Will try to extract if available
                    "fixtures": fixtures
                })
    
    # Pattern 2: Look for tables with match results
    if not gameweeks:
        match_tables = soup.find_all("table", class_=re.compile(r"fixture|match|result", re.I))
        
        if match_tables:
            # Group by table (assuming each table is a gameweek)
            for idx, table in enumerate(match_tables, 1):
                fixtures = extract_fixtures_from_table(table, teams)
                if fixtures:
                    gameweeks.append({
                        "week": idx,
                        "date": None,
                        "fixtures": fixtures
                    })
    
    # Pattern 3: Look for any table rows that look like match results
    if not gameweeks:
        all_tables = soup.find_all("table")
        current_week = None
        week_fixtures = []
        
        for table in all_tables:
            rows = table.find_all("tr")
            for row in rows:
                # Check if row contains match data (has scores, team names)
                cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
                
                # Look for score pattern (e.g., "3-1", "2 - 2")
                score_match = None
                for cell in cells:
                    score_match = re.search(r"(\d+)\s*[-–]\s*(\d+)", cell)
                    if score_match:
                        break
                
                if score_match:
                    fixture = parse_fixture_row(row, teams, score_match)
                    if fixture:
                        if not current_week:
                            current_week = 1
                        week_fixtures.append(fixture)
        
        if week_fixtures:
            # For now, group all into one gameweek - will refine based on actual structure
            gameweeks.append({
                "week": 1,
                "date": None,
                "fixtures": week_fixtures
            })
    
    return gameweeks


def extract_fixtures_from_section(section, teams: List[str]) -> List[Dict]:
    """Extract fixtures from a section element."""
    fixtures = []
    rows = section.find_all(["tr", "div"], class_=re.compile(r"match|fixture", re.I))
    
    for row in rows:
        text = row.get_text()
        score_match = re.search(r"(\d+)\s*[-–]\s*(\d+)", text)
        if score_match:
            fixture = parse_fixture_row(row, teams, score_match)
            if fixture:
                fixtures.append(fixture)
    
    return fixtures


def extract_fixtures_from_table(table, teams: List[str]) -> List[Dict]:
    """Extract fixtures from a table element."""
    fixtures = []
    rows = table.find_all("tr")[1:]  # Skip header
    
    for row in rows:
        cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
        text = " ".join(cells)
        score_match = re.search(r"(\d+)\s*[-–]\s*(\d+)", text)
        
        if score_match:
            fixture = parse_fixture_row(row, teams, score_match)
            if fixture:
                fixtures.append(fixture)
    
    return fixtures


def parse_fixture_row(row, teams: List[str], score_match: re.Match) -> Optional[Dict]:
    """
    Parse a table row or element to extract fixture data.
    
    Args:
        row: BeautifulSoup element containing match data
        teams: List of valid team names
        score_match: Regex match object for the score
        
    Returns:
        Dictionary with home, away, home_score, away_score, or None if invalid
    """
    text = row.get_text()
    cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th", "span", "div"])]
    
    home_score = int(score_match.group(1))
    away_score = int(score_match.group(2))
    
    # Try to find team names in the row
    home_team = None
    away_team = None
    
    # Look for team names before and after the score
    for team in teams:
        # Check if team name appears in the text
        if team in text:
            # Try to determine if it's home or away based on position relative to score
            score_pos = text.find(score_match.group(0))
            team_pos = text.find(team)
            
            if team_pos < score_pos:
                if not home_team:
                    home_team = team
            else:
                if not away_team:
                    away_team = team
    
    # Fallback: use first two teams found in order
    if not home_team or not away_team:
        found_teams = [team for team in teams if team in text]
        if len(found_teams) >= 2:
            home_team = found_teams[0]
            away_team = found_teams[1]
        elif len(found_teams) == 1:
            home_team = found_teams[0]
            # Try to infer away team from context
            away_team = None
    
    if home_team and away_team:
        return {
            "home": home_team,
            "away": away_team,
            "home_score": home_score,
            "away_score": away_score
        }
    
    return None


def extract_league_info(soup: BeautifulSoup) -> Dict[str, str]:
    """
    Extract league metadata (name, venue, etc.).
    
    Args:
        soup: Parsed HTML soup
        
    Returns:
        Dictionary with league_name and venue
    """
    info = {
        "league_name": "Players Lounge",
        "venue": "Islington Market Road"
    }
    
    # Try to extract from page title or headings
    title = soup.find("title")
    if title:
        title_text = title.get_text()
        if "Players Lounge" in title_text:
            info["league_name"] = "Players Lounge"
    
    h1 = soup.find("h1")
    if h1:
        h1_text = h1.get_text(strip=True)
        if h1_text:
            info["league_name"] = h1_text
    
    return info


def scrape_league() -> Dict:
    """
    Main scraping function.
    
    Returns:
        Dictionary with league data structure
    """
    print(f"Fetching data from {LEAGUE_URL}...")
    soup = fetch_page(LEAGUE_URL)
    
    print("Extracting league information...")
    league_info = extract_league_info(soup)
    
    print("Extracting teams...")
    teams = extract_teams(soup)
    print(f"Found {len(teams)} teams: {', '.join(teams)}")
    
    print("Extracting fixtures...")
    gameweeks = extract_fixtures(soup, teams)
    print(f"Found {len(gameweeks)} gameweeks with {sum(len(gw['fixtures']) for gw in gameweeks)} total fixtures")
    
    result = {
        "league_name": league_info["league_name"],
        "venue": league_info["venue"],
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
        raise


if __name__ == "__main__":
    main()
