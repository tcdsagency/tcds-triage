#!/bin/bash
# =============================================================================
# IVANS Auto-Uploader
# =============================================================================
# Watches /home/todd/ivanspoldls/ for new ZIP files and uploads them
# to the tcds-triage Vercel app for processing.
#
# Install on VM (75.37.55.209):
#   scp scripts/ivans-uploader.sh todd@75.37.55.209:/home/todd/services/ivans-uploader.sh
#   ssh todd@75.37.55.209 "chmod +x /home/todd/services/ivans-uploader.sh"
#
# Add to crontab (run every 30 minutes):
#   crontab -e
#   */30 * * * * /home/todd/services/ivans-uploader.sh >> /tmp/ivans-uploader.log 2>&1
#
# Or run manually:
#   /home/todd/services/ivans-uploader.sh
# =============================================================================

IVANS_DIR="/home/todd/ivanspoldls"
PROCESSED_LOG="/home/todd/services/ivans-processed.log"
UPLOAD_URL="https://tcds-triage.vercel.app/api/renewals/upload"
LOG_PREFIX="[ivans-uploader]"

# Create processed log if it doesn't exist
touch "$PROCESSED_LOG"

echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') Starting scan of $IVANS_DIR"

# Count new files
NEW_COUNT=0
UPLOADED_COUNT=0
FAILED_COUNT=0

# Find all ZIP files in the directory
for zipfile in "$IVANS_DIR"/*.zip "$IVANS_DIR"/*.ZIP; do
  # Skip if no matches (glob didn't expand)
  [ -e "$zipfile" ] || continue

  filename=$(basename "$zipfile")

  # Skip if already processed
  if grep -qF "$filename" "$PROCESSED_LOG" 2>/dev/null; then
    continue
  fi

  NEW_COUNT=$((NEW_COUNT + 1))
  filesize=$(stat -c%s "$zipfile" 2>/dev/null || stat -f%z "$zipfile" 2>/dev/null)
  echo "$LOG_PREFIX Found new file: $filename (${filesize} bytes)"

  # Upload via curl
  HTTP_CODE=$(curl -s -o /tmp/ivans-upload-response.json -w "%{http_code}" \
    -X POST \
    -F "file=@${zipfile}" \
    "$UPLOAD_URL" \
    --connect-timeout 30 \
    --max-time 120)

  if [ "$HTTP_CODE" = "200" ]; then
    BATCH_ID=$(cat /tmp/ivans-upload-response.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('batchId',''))" 2>/dev/null || echo "unknown")
    echo "$LOG_PREFIX  ✓ Uploaded $filename → batch: $BATCH_ID (HTTP $HTTP_CODE)"
    echo "$filename" >> "$PROCESSED_LOG"
    UPLOADED_COUNT=$((UPLOADED_COUNT + 1))
  else
    RESPONSE=$(cat /tmp/ivans-upload-response.json 2>/dev/null || echo "no response")
    echo "$LOG_PREFIX  ✗ FAILED $filename (HTTP $HTTP_CODE): $RESPONSE"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi

  # Small delay between uploads to avoid overwhelming the server
  sleep 2
done

echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') Done. New: $NEW_COUNT | Uploaded: $UPLOADED_COUNT | Failed: $FAILED_COUNT"
