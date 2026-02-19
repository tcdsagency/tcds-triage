#!/bin/bash
# =============================================================================
# IVANS Bulk Re-Upload (Force as Renewal)
# =============================================================================
# Re-uploads ALL ZIP files from /home/todd/ivanspoldls/ with forceAsRenewal=true
# so that past-dated transactions are treated as renewal candidates.
#
# Usage:
#   scp scripts/ivans-reupload-all.sh todd@75.37.55.209:/home/todd/services/ivans-reupload-all.sh
#   ssh todd@75.37.55.209 "chmod +x /home/todd/services/ivans-reupload-all.sh && nohup /home/todd/services/ivans-reupload-all.sh > /tmp/ivans-reupload.log 2>&1 &"
#   # Monitor:
#   ssh todd@75.37.55.209 "tail -f /tmp/ivans-reupload.log"
# =============================================================================

IVANS_DIR="/home/todd/ivanspoldls"
UPLOAD_URL="https://tcds-triage.vercel.app/api/renewals/upload"
LOG_PREFIX="[ivans-reupload]"

TOTAL=0
UPLOADED=0
FAILED=0
SKIPPED=0

# Count files first
FILE_COUNT=$(ls "$IVANS_DIR"/*.zip 2>/dev/null | wc -l)
echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') Starting bulk re-upload of $FILE_COUNT ZIP files with forceAsRenewal=true"

for zipfile in "$IVANS_DIR"/*.zip; do
  [ -e "$zipfile" ] || continue

  TOTAL=$((TOTAL + 1))
  filename=$(basename "$zipfile")
  filesize=$(stat -c%s "$zipfile" 2>/dev/null || stat -f%z "$zipfile" 2>/dev/null)

  # Progress every 50 files
  if [ $((TOTAL % 50)) -eq 0 ]; then
    echo "$LOG_PREFIX Progress: $TOTAL/$FILE_COUNT (uploaded=$UPLOADED failed=$FAILED skipped=$SKIPPED)"
  fi

  # Upload via curl with forceAsRenewal
  HTTP_CODE=$(curl -s -o /tmp/ivans-reupload-response.json -w "%{http_code}" \
    -X POST \
    -F "file=@${zipfile}" \
    -F "forceAsRenewal=true" \
    "$UPLOAD_URL" \
    --connect-timeout 30 \
    --max-time 120)

  if [ "$HTTP_CODE" = "200" ]; then
    BATCH_ID=$(cat /tmp/ivans-reupload-response.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('batchId',''))" 2>/dev/null || echo "unknown")
    UPLOADED=$((UPLOADED + 1))
  else
    RESPONSE=$(cat /tmp/ivans-reupload-response.json 2>/dev/null || echo "no response")
    echo "$LOG_PREFIX  ✗ FAILED $filename (HTTP $HTTP_CODE): $RESPONSE"
    FAILED=$((FAILED + 1))
  fi

  # Small delay to avoid overwhelming the server
  sleep 3
done

echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') COMPLETE. Total: $TOTAL | Uploaded: $UPLOADED | Failed: $FAILED | Skipped: $SKIPPED"
