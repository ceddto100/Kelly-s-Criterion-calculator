#!/bin/bash
# Sync NFL stats from root stats/ to frontend/public/stats/
cp stats/nfl_*.csv frontend/public/stats/
echo "✓ NFL stats synced to frontend/public/stats/"
