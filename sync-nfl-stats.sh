#!/bin/bash
# Sync NFL stats from stats/nfl/ to frontend/public/stats/nfl/
mkdir -p frontend/public/stats/nfl
cp stats/nfl/*.csv frontend/public/stats/nfl/
echo "✓ NFL stats synced to frontend/public/stats/nfl/"
