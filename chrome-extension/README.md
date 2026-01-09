# TCDS Call Pop - Chrome Extension

Real-time call popup with customer info and AI insights for TCDS Insurance agents.

## Features

- **Real-time Call Detection** - Connects to your realtime WebSocket server for instant call notifications
- **Customer Lookup** - Automatically looks up caller by phone number
- **AI Insights** - Shows AI-generated overview including likely call reason and suggested questions
- **Live Transcript** - Displays real-time call transcription
- **System Notifications** - Desktop notifications when calls come in
- **Quick Profile Access** - One-click access to full customer profile

## Installation

### 1. Generate Icons

Before loading the extension, you need to create PNG icons. You can use any image editor or online tool to create icons in these sizes:

- `icons/icon16.png` (16x16 pixels)
- `icons/icon32.png` (32x32 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

**Quick option:** Use your TCDS logo or create a simple green "T" icon.

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

### 3. Configure Settings

1. Click the TCDS extension icon in your browser toolbar
2. Click the gear icon to open settings
3. Enter your configuration:
   - **TCDS API URL**: `https://tcds-triage.vercel.app` (or your deployment)
   - **WebSocket URL**: `wss://realtime.tcdsagency.com/ws/calls`
   - **Your Extension**: Your 3CX extension number (e.g., 101)
   - **Auth Token**: Optional API token for authenticated requests
4. Click "Save Settings"

## Usage

Once configured, the extension will:

1. **Connect** to the realtime WebSocket server
2. **Listen** for call events on your extension
3. **Show notification** when a call comes in
4. **Display popup** with customer info and AI insights
5. **Update in real-time** with transcript and call status

### Badge Indicators

- **No badge** - Connected, no active call
- **Yellow !** - Incoming call (ringing)
- **Green 1** - Active call in progress
- **Red !** - Disconnected from server

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────────────────────────────────────────────────┤
│  Background Service Worker                                   │
│  ├── WebSocket connection to realtime server                │
│  ├── Call event handling                                    │
│  ├── Customer & AI data fetching                            │
│  └── Notification management                                │
├─────────────────────────────────────────────────────────────┤
│  Popup UI                                                    │
│  ├── Customer info display                                  │
│  ├── AI insights (likely call reason, suggestions)          │
│  ├── Live transcript                                        │
│  └── Quick actions (view profile)                           │
├─────────────────────────────────────────────────────────────┤
│  Options Page                                                │
│  ├── Connection settings                                    │
│  ├── Notification preferences                               │
│  └── Connection testing                                     │
└─────────────────────────────────────────────────────────────┘
         │
         │ WebSocket
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Realtime Server                                 │
│         wss://realtime.tcdsagency.com/ws/calls              │
│                                                              │
│  Events:                                                     │
│  - call_ringing                                             │
│  - call_started                                             │
│  - call_updated                                             │
│  - call_ended                                               │
│  - transcript_segment                                       │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTP API
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    TCDS API                                  │
│            https://tcds-triage.vercel.app                   │
│                                                              │
│  Endpoints used:                                             │
│  - GET  /api/calls/popup?phone=...  (customer lookup)       │
│  - POST /api/ai/quick-overview      (AI insights)           │
└─────────────────────────────────────────────────────────────┘
```

## Development

### File Structure

```
chrome-extension/
├── manifest.json          # Extension manifest (v3)
├── icons/                 # Extension icons (16, 32, 48, 128px)
├── src/
│   ├── background.js      # Service worker (WebSocket, events)
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Popup logic
│   ├── options.html       # Settings page
│   └── options.js         # Settings logic
└── README.md
```

### Testing Changes

1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the TCDS extension card
4. Test your changes

### Debugging

- **Background script**: Click "Service Worker" link on the extension card in `chrome://extensions/`
- **Popup**: Right-click the popup and select "Inspect"
- **Console logs**: All logs are prefixed with `[TCDS]`

## Troubleshooting

### Extension shows "Not Connected"

1. Check that your WebSocket URL is correct
2. Verify the realtime server is running
3. Check browser console for connection errors
4. Try the "Test Connection" button in settings

### No notifications appearing

1. Check that notifications are enabled in settings
2. Verify Chrome has notification permissions
3. Check system notification settings (Do Not Disturb, etc.)

### Customer info not loading

1. Verify your API URL is correct
2. Check if auth token is required and set
3. Look for errors in the background script console

## License

Internal use only - TCDS Insurance Agency
