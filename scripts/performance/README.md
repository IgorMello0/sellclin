# Performance checks

Use a staging database restored from an anonymized production backup. Never point load tests at the live production database.

API test with authenticated application routes:

```powershell
$env:PERF_BASE_URL = "https://staging.example.com"
$env:PERF_TOKEN = "staging-jwt"
$env:PERF_COMPANY_ID = "1"
npm run perf:api:20
npm run perf:api:50
```

The command fails when more than 1% of requests fail or p95 exceeds 800 ms. Override with `PERF_ERROR_RATE_LIMIT` and `PERF_P95_LIMIT_MS` when a route has a documented target.

For Lighthouse mobile, start the production preview and run:

```powershell
npm run preview -- --host 127.0.0.1
npm run perf:lighthouse
```

The report is saved as `lighthouse-mobile.html`. Test `/entrar` as well as `/`; authenticated CRM pages require a scripted browser session and should be measured separately in staging.
