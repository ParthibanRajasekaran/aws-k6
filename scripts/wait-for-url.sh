#!/bin/bash
# Wait for a local HTTP endpoint to be up
# Usage: ./wait-for-url.sh http://localhost:3000/grocery [timeout_seconds]

URL="$1"
TIMEOUT="${2:-60}"
INTERVAL=2
ELAPSED=0

while ! curl -sf "$URL" > /dev/null; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "Timeout waiting for $URL after $TIMEOUT seconds."
    exit 1
  fi
  echo "Waiting for $URL... ($ELAPSED/$TIMEOUT)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED+INTERVAL))
done

echo "$URL is up!"
