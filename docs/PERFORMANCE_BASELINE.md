# Performance baseline — 2026-10-06

## Frontend delivery

Production build before route splitting:

- Initial JavaScript: 1,747.25 kB raw / 448.02 kB gzip.
- CSS: 258.33 kB raw / 36.46 kB gzip.

Production build after route splitting:

- Initial shared JavaScript: 334.94 kB raw / 101.78 kB gzip.
- Home route: 82.28 kB raw / 18.23 kB gzip.
- Login route: 11.76 kB raw / 4.09 kB gzip.
- CSS: 258.33 kB raw / 36.46 kB gzip.

The initial compressed JavaScript payload dropped by approximately 77%. Admin remains a large route, but it is downloaded only when that route is opened.

## Images

The five images optimized for active pages dropped from approximately 3.84 MB to 221 KB. The original dashboard PNG remains for the existing password-recovery work while the optimized WebP is used by home and login.

## Local production-preview checks

Mobile viewport (390 × 844), warm navigation to network idle:

- 419 ms
- 553 ms
- 298 ms

Static preview load, run sequentially:

| Concurrent workers | Requests | Errors | Requests/s | p50 | p95 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 1,658 | 0 | 165.8 | 107 ms | 215 ms |
| 50 | 1,859 | 0 | 185.9 | 245 ms | 516 ms |

These numbers validate the local Vite production preview and are not a substitute for an API test against the staging PostgreSQL database and production reverse proxy.

## Remaining staging measurement

Run `npm run perf:api:20` and `npm run perf:api:50` against staging with an anonymized production-size database, JWT and company ID. The commands, thresholds and setup are documented in `scripts/performance/README.md`.

Lighthouse CLI was prepared, but this sandbox blocks its connection to Chrome's local debugging port. Run `npm run perf:lighthouse` outside the sandbox while the production preview is available at port 4173.
