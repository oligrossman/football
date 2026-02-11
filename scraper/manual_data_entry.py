#!/usr/bin/env python3
"""
Helper script to manually create/update the league data JSON file.

Use this if the automated scraper fails due to 403 errors or other issues.
"""

import json
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_FILE = DATA_DIR / "results.json"


def create_manual_data():
    """Interactive script to create league data manually."""
    print("=" * 60)
    print("Manual League Data Entry")
    print("=" * 60)
    print()
    
    # Get league info
    league_name = input("League name [Players Lounge]: ").strip() or "Players Lounge"
    venue = input("Venue [Islington Market Road]: ").strip() or "Islington Market Road"
    
    # Get teams
    print("\nEnter team names (one per line, empty line to finish):")
    teams = []
    while True:
        team = input(f"Team {len(teams) + 1}: ").strip()
        if not team:
            break
        teams.append(team)
    
    if not teams:
        print("⚠️  No teams entered. Using placeholder.")
        teams = ["Colonel Getafe", "Team B", "Team C", "Team D"]
    
    print(f"\n✓ Added {len(teams)} teams: {', '.join(teams)}")
    
    # Get gameweeks
    print("\nEnter gameweek data:")
    gameweeks = []
    week_num = 1
    
    while True:
        print(f"\n--- Gameweek {week_num} ---")
        date = input(f"Date (YYYY-MM-DD) [or Enter to skip]: ").strip()
        if not date:
            break
        
        fixtures = []
        print("Enter fixtures (format: Home Team vs Away Team, HomeScore-AwayScore)")
        print("Example: Colonel Getafe vs Team B, 3-1")
        print("(Empty line to finish this gameweek)")
        
        while True:
            fixture_input = input("Fixture: ").strip()
            if not fixture_input:
                break
            
            # Parse fixture
            try:
                if " vs " in fixture_input or " v " in fixture_input:
                    separator = " vs " if " vs " in fixture_input else " v "
                    parts = fixture_input.split(separator)
                    if len(parts) == 2:
                        home_part = parts[0].strip()
                        away_part = parts[1].strip()
                        
                        # Extract scores
                        if "," in away_part:
                            away_team, scores = away_part.rsplit(",", 1)
                            scores = scores.strip()
                            if "-" in scores:
                                home_score, away_score = map(int, scores.split("-"))
                                home_team = home_part.strip()
                                away_team = away_team.strip()
                                
                                fixtures.append({
                                    "home": home_team,
                                    "away": away_team,
                                    "home_score": home_score,
                                    "away_score": away_score
                                })
                                print(f"  ✓ Added: {home_team} {home_score}-{away_score} {away_team}")
                                continue
                
                print("  ⚠️  Could not parse. Try: 'Team A vs Team B, 3-1'")
            except Exception as e:
                print(f"  ⚠️  Error: {e}")
        
        if fixtures:
            gameweeks.append({
                "week": week_num,
                "date": date,
                "fixtures": fixtures
            })
            week_num += 1
        else:
            break
    
    # Create data structure
    data = {
        "league_name": league_name,
        "venue": venue,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "teams": teams,
        "gameweeks": gameweeks
    }
    
    # Save
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 60)
    print(f"✓ Data saved to {DATA_FILE}")
    print(f"  - {len(teams)} teams")
    print(f"  - {len(gameweeks)} gameweeks")
    print(f"  - {sum(len(gw['fixtures']) for gw in gameweeks)} total fixtures")
    print("=" * 60)


if __name__ == "__main__":
    try:
        create_manual_data()
    except KeyboardInterrupt:
        print("\n\nCancelled.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
