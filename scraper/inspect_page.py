#!/usr/bin/env python3
"""
Quick script to inspect the playfootball.net page structure.
Run this to see what HTML elements contain the team and fixture data.
"""

import urllib.request
import urllib.parse
from html.parser import HTMLParser

URL = "https://www.playfootball.net/venues/islington-market-road/players-lounge/3359/15144/186"

def fetch_page():
    """Fetch the page HTML."""
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return response.read().decode('utf-8')

if __name__ == "__main__":
    html = fetch_page()
    
    # Save to file for inspection
    with open('page_source.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print("Page HTML saved to page_source.html")
    print(f"Total length: {len(html)} characters")
    
    # Look for common patterns
    if "Colonel Getafe" in html:
        print("\n✓ Found 'Colonel Getafe' in the page!")
        # Find context around it
        idx = html.find("Colonel Getafe")
        print("Context:", html[max(0, idx-100):idx+200])
    
    # Look for table structures
    if "<table" in html.lower():
        print("\n✓ Found table elements")
    
    if "gameweek" in html.lower() or "fixture" in html.lower():
        print("✓ Found gameweek/fixture references")
