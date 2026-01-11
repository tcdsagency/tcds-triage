# MCI Payment Checker Microservice

Automated service for checking mortgagee payment status on MyCoverageInfo.com (MCI).

## Overview

This service uses browser automation (Playwright) to:
1. Navigate to MCI verification page
2. Enter loan number and ZIP code
3. Solve CAPTCHA using 2Captcha service
4. Extract and return payment status

## Deployment

### Railway (Recommended)

1. Create a new project on Railway
2. Connect this directory
3. Set environment variables:
   - `API_KEY` - Secure key for authenticating requests
   - `TWOCAPTCHA_API_KEY` - Your 2Captcha API key
4. Deploy

### Docker

```bash
# Build
docker build -t mci-checker .

# Run
docker run -p 8080:8080 \
  -e API_KEY=your_api_key \
  -e TWOCAPTCHA_API_KEY=your_2captcha_key \
  mci-checker
```

## API Endpoints

### Health Check
```
GET /health
```

### Check Payment Status
```
POST /api/v1/check
Headers:
  X-API-Key: your_api_key
Body:
{
  "loan_number": "123456789",
  "zip_code": "12345",
  "last_name": "Smith"  // optional
}

Response:
{
  "success": true,
  "loan_number": "123456789",
  "payment_status": "current",  // current, late, grace_period, lapsed, unknown
  "paid_through_date": "2024-03-01",
  "next_due_date": "2024-04-01",
  "amount_due": 1234.56,
  "policy_number": "HO-123456",
  "carrier": "State Farm",
  "effective_date": "2024-01-01",
  "expiration_date": "2025-01-01",
  "duration_ms": 5432
}
```

### Get 2Captcha Balance
```
GET /api/v1/balance
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | API key for authenticating requests |
| `TWOCAPTCHA_API_KEY` | Yes | 2Captcha API key for CAPTCHA solving |
| `PORT` | No | Server port (default: 8080) |

### 2Captcha Setup

1. Create account at https://2captcha.com/
2. Add funds to your account ($3-5 is enough for hundreds of CAPTCHAs)
3. Copy your API key from the dashboard
4. Set as `TWOCAPTCHA_API_KEY` environment variable

## Rate Limiting

The service includes:
- 30 second delay between checks (configurable in TCDS settings)
- Retry logic with exponential backoff
- Daily check budget (default: 200/day)

## Integration with TCDS

1. Deploy this service and note the URL
2. In TCDS, go to Mortgagee Payments > Settings
3. Set the Microservice URL to your deployment URL
4. Set the API Key to match your `API_KEY` env var
5. Run a sync to import mortgagees from HawkSoft
6. Enable the scheduler or trigger manual runs

## Troubleshooting

### CAPTCHA failures
- Ensure your 2Captcha account has balance
- Check the API key is correct
- Some CAPTCHAs may require reCAPTCHA v3 instead of v2

### Loan not found
- Verify the loan number format
- Ensure ZIP code matches the property
- Some loans may not be registered with MCI

### Timeouts
- MCI can be slow during peak hours
- Increase timeout values if needed
- Check Railway logs for details
