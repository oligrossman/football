#!/bin/bash
# Quick script to run the scraper and update the data

cd "$(dirname "$0")/scraper"

echo "Installing dependencies..."
pip3 install -q -r requirements.txt

echo "Running scraper..."
python3 scrape.py

echo ""
echo "✓ Scraper complete! Check data/results.json"
echo "Now open index.html in your browser to see your dashboard!"
