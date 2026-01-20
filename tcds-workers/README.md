# TCDS Workers

BullMQ workers for TCDS-Triage, deployed on Railway.

## Architecture

```
Vercel (Main App) ──ADD JOBS──> Upstash Redis <──POLL JOBS── Railway (Workers)
```

### Components

| Component | Platform | Role |
|-----------|----------|------|
| Next.js App | Vercel | Web UI, API routes, adds jobs to queues |
| Redis | Upstash | Job queue storage |
| Workers | Railway | Background job processing |

## Workers

| Worker | Queue | Concurrency | Purpose |
|--------|-------|-------------|---------|
| Transcript | transcript-processing | 5 | Post-call AI extraction |
| Customer Sync | customer-sync | 3 | CRM synchronization |
| Risk Monitor | risk-monitor | 1 | Property monitoring |
| Embeddings | embeddings | 2 | Knowledge base vectors |
| Notifications | notifications | 5 | Email/SMS sending |

## Scheduled Jobs

| Job | Schedule | Queue |
|-----|----------|-------|
| Customer Sync | Every hour | customer-sync |
| Risk Monitor | Daily 6 AM CT | risk-monitor |
| Embeddings | Daily 2 AM CT | embeddings |
| Payment Reminders | Daily 8 AM CT | notifications |
| Expiration Notices | Daily 9 AM CT | notifications |

## Local Development

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type check only
npm run typecheck
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Yes | Upstash Redis connection string |
| `TCDS_APP_URL` | Yes | Main app URL (Vercel) |
| `INTERNAL_API_KEY` | Yes | Secret key for internal API calls |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `VOIPTOOLS_SQL_SERVER` | Yes | VoIPTools SQL Server hostname |
| `VOIPTOOLS_SQL_DATABASE` | Yes | VoIPTools database name |
| `VOIPTOOLS_SQL_USER` | Yes | SQL Server username |
| `VOIPTOOLS_SQL_PASSWORD` | Yes | SQL Server password |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `AGENCYZOOM_API_KEY` | No | AgencyZoom API key |
| `AGENCYZOOM_API_URL` | No | AgencyZoom API URL |
| `PORT` | No | Health check port (default: 3001) |
| `LOG_LEVEL` | No | Logging level (default: info) |
| `NODE_ENV` | No | Environment (default: development) |

## Deployment to Railway

### 1. Create Railway Project

1. Go to [Railway](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Select the `tcds-workers` directory as the root

### 2. Configure Environment Variables

Add all required environment variables in Railway dashboard:
- Project Settings → Variables
- Copy values from `.env.example`

### 3. Configure Build

Railway auto-detects the Dockerfile. Verify settings:
- Builder: Dockerfile
- Dockerfile path: Dockerfile
- Start command: node dist/index.js

### 4. Health Check

Railway uses the `/health` endpoint for health checks:
- Path: `/health`
- Timeout: 30 seconds
- Port: 3001 (configurable via PORT env var)

### 5. Deploy

Push to main branch to trigger deployment:

```bash
git push origin main
```

## Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Full health check (workers + queues + redis) |
| `GET /metrics` | Detailed queue statistics |
| `GET /ready` | Readiness probe (redis only) |
| `GET /live` | Liveness probe (always returns 200) |

### Health Response Example

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "redis": true,
  "workers": {
    "healthy": true,
    "workers": [
      { "name": "transcript-processing", "running": true, "paused": false },
      { "name": "customer-sync", "running": true, "paused": false }
    ]
  },
  "queues": {
    "healthy": true,
    "queues": [
      { "name": "transcript-processing", "waiting": 0, "active": 1, "completed": 150, "failed": 2, "delayed": 5 }
    ]
  }
}
```

## Job Flow Example

### Transcript Processing

1. **Call Ends** (3CX Webhook → Vercel)
   - Vercel receives call_ended webhook
   - Adds job to `transcript-processing` queue with 30s delay

2. **Job Queued** (Upstash Redis)
   - Job waits in delayed state for 30 seconds
   - Moves to waiting state after delay

3. **Worker Processes** (Railway)
   - Worker picks up job
   - Queries VoIPTools SQL Server for transcript
   - Retries with exponential backoff if not found (SQL write delay)
   - Runs Claude AI extraction
   - Saves wrapup to Vercel API
   - Creates AgencyZoom note if applicable

4. **Complete** (~35 seconds total)

## Monitoring

### Logs

Railway provides built-in log viewing:
- Dashboard → Deployments → View Logs

Log format (production):
```json
{"level":"info","message":"Job completed","worker":"transcript-processing","jobId":"123","timestamp":"2024-01-15T10:30:00.000Z"}
```

### Metrics

Access queue metrics via API:
```bash
curl https://your-workers.railway.app/metrics
```

## Troubleshooting

### Workers Not Starting

1. Check environment variables are set
2. Verify Redis connection string
3. Check Railway deployment logs

### Jobs Stuck in Queue

1. Check worker health: `GET /health`
2. Check for errors in logs
3. Verify main app API is accessible

### SQL Server Connection Issues

1. Verify SQL Server credentials
2. Check firewall rules allow Railway IPs
3. Verify `TrustServerCertificate` is enabled

## Development

### Adding a New Worker

1. Create worker file in `src/workers/`
2. Define job data interface in `src/queues/index.ts`
3. Create queue in `src/queues/index.ts`
4. Register worker in `src/workers/index.ts`
5. Add queue client helper in main app

### Testing Locally

```bash
# Start workers in dev mode
npm run dev

# Add a test job (from main app)
curl -X POST http://localhost:3000/api/test/queue-job \
  -H "Content-Type: application/json" \
  -d '{"queue": "transcript-processing", "data": {...}}'
```
