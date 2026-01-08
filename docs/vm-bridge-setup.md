# VM Bridge - Deepgram Transcription Setup

This document contains the setup and access details for the VM Bridge running on GCP VM.

## Overview

The VM Bridge captures audio from 3CX calls via SIP/RTP and streams to Deepgram for real-time transcription. It was complex to set up - preserve this documentation.

## Accessing the VM

### SSH Login

```bash
ssh manus_temp@34.145.14.37
Password: manus
```

## File Locations

| Path | Description |
|------|-------------|
| `/home/manus_temp/transcription-bridge/` | Main application directory |
| `/home/manus_temp/transcription-bridge/index.js` | Main code |
| `/home/manus_temp/transcription-bridge/.env` | Configuration |
| `/home/manus_temp/transcription-bridge/package.json` | Dependencies |
| `/tmp/bridge.log` | Logs |

## Useful Commands

### Navigate to Project

```bash
cd /home/manus_temp/transcription-bridge/
```

### View/Edit Main Code

```bash
nano index.js
# or
vim index.js
# or
cat index.js
```

### View/Edit Configuration

```bash
nano .env
```

### View Real-Time Logs

```bash
tail -f /tmp/bridge.log
```

### View Recent Logs

```bash
tail -100 /tmp/bridge.log
```

### Search Logs for Specific Calls

```bash
grep "sessionId" /tmp/bridge.log
grep "401" /tmp/bridge.log
grep "INVITE" /tmp/bridge.log
```

## Process Management

### Check if Bridge is Running

```bash
ps aux | grep "node.*index.js" | grep -v grep
```

### Stop the Bridge

```bash
pkill -f "node.*index.js"
```

### Start the Bridge

```bash
cd /home/manus_temp/transcription-bridge/
nohup node index.js > /tmp/bridge.log 2>&1 &
```

### Restart the Bridge

```bash
pkill -f "node.*index.js"
sleep 2
cd /home/manus_temp/transcription-bridge/
nohup node index.js > /tmp/bridge.log 2>&1 &
```

### Check if Started Successfully

```bash
tail -30 /tmp/bridge.log
```

## Making Code Changes

1. Edit the code:
   ```bash
   cd /home/manus_temp/transcription-bridge/
   nano index.js
   ```

2. Save changes (in nano: `Ctrl+O`, `Enter`, `Ctrl+X`)

3. Restart the bridge:
   ```bash
   pkill -f "node.*index.js"
   sleep 2
   nohup node index.js > /tmp/bridge.log 2>&1 &
   ```

4. Verify it's running:
   ```bash
   tail -30 /tmp/bridge.log
   ```

## Configuration (.env file)

The `.env` file contains all the credentials and settings:

```bash
nano /home/manus_temp/transcription-bridge/.env
```

### Key Settings

| Variable | Description |
|----------|-------------|
| `DEEPGRAM_API_KEY` | Deepgram API key for transcription |
| `VOIPTOOLS_USERNAME` | VoIPTools API username |
| `VOIPTOOLS_PASSWORD` | VoIPTools API password |
| `WEBHOOK_URL` | Where transcripts are sent (tcdsagency.vercel.app) |
| `SIP_REGISTRAR` | 3CX IP address (10.138.0.3:5060) |
| `LOCAL_IP` | VM internal IP (10.138.0.6) |

## Backup the Code

### Create a Backup

```bash
cd /home/manus_temp/
tar -czf transcription-bridge-backup-$(date +%Y%m%d).tar.gz transcription-bridge/
```

### Download Backup to Local Machine

```bash
scp manus_temp@34.145.14.37:/home/manus_temp/transcription-bridge-backup-*.tar.gz .
```

## Monitoring & Debugging

### Monitor Logs During Test Call

```bash
tail -f /tmp/bridge.log
```

### Check for Errors

```bash
grep -i "error\|fail\|401" /tmp/bridge.log | tail -20
```

### Check Recent Registrations

```bash
grep "REGISTER" /tmp/bridge.log | tail -20
```

### Check Recent Calls

```bash
grep "INVITE\|VoIPTools" /tmp/bridge.log | tail -30
```

## Installing Additional Dependencies

```bash
cd /home/manus_temp/transcription-bridge/
npm install <package-name>
```

Then restart the bridge.

## Architecture

```
3CX (10.138.0.3:5060)
      |
      | SIP REGISTER/INVITE
      v
VM Bridge (34.145.14.37:3000)
      |
      | RTP Audio Stream
      v
Deepgram (Real-time)
      |
      | Transcript Segments
      v
Webhook (tcdsagency.vercel.app/api/calls/{sessionId}/transcript/segment)
```

## Webhook URL

The VM Bridge sends transcript segments to:
```
https://tcdsagency.vercel.app/api/calls/{sessionId}/transcript/segment
```

Using header: `X-Api-Key: 2058475616`
