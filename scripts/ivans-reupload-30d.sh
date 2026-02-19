#!/bin/bash
IVANS_DIR="/home/todd/ivanspoldls"
UPLOAD_URL="https://tcds-triage.vercel.app/api/renewals/upload"
LOG_PREFIX="[ivans-reupload-30d]"
CUTOFF="20260119"
TOTAL=0
UPLOADED=0
FAILED=0

echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') Re-uploading ZIPs with date >= $CUTOFF (forceAsRenewal=true)"

for zipfile in "$IVANS_DIR"/*.zip; do
  [ -e "$zipfile" ] || continue
  filename=$(basename "$zipfile")
  filedate=$(echo "$filename" | cut -d_ -f1)
  if [ "$filedate" \< "$CUTOFF" ]; then
    continue
  fi
  TOTAL=$((TOTAL + 1))
  if [ $((TOTAL % 25)) -eq 0 ]; then
    echo "$LOG_PREFIX Progress: $TOTAL (uploaded=$UPLOADED failed=$FAILED)"
  fi
  HTTP_CODE=$(curl -s -o /tmp/ivans-reupload-response.json -w "%{http_code}" -X POST -F "file=@${zipfile}" -F "forceAsRenewal=true" "$UPLOAD_URL" --connect-timeout 30 --max-time 120)
  if [ "$HTTP_CODE" = "200" ]; then
    UPLOADED=$((UPLOADED + 1))
  else
    RESPONSE=$(cat /tmp/ivans-reupload-response.json 2>/dev/null || echo "no response")
    echo "$LOG_PREFIX FAILED $filename (HTTP $HTTP_CODE): $RESPONSE"
    FAILED=$((FAILED + 1))
  fi
  sleep 3
done

echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') COMPLETE. Total: $TOTAL Uploaded: $UPLOADED Failed: $FAILED"
