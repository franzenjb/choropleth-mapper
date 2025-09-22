#!/bin/bash

# Get current time in ET
TIMESTAMP=$(TZ='America/New_York' date '+%b %d, %Y %I:%M %p ET')

# Update the app.js file with the timestamp
sed -i '' "s/const buildTime = '.*'/const buildTime = '$TIMESTAMP'/" app.js

echo "Updated build timestamp to: $TIMESTAMP"