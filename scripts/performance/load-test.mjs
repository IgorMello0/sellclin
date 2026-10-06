import { writeFile } from 'node:fs/promises'

const baseUrl = String(process.env.PERF_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '')
const token = String(process.env.PERF_TOKEN || '')
const companyId = String(process.env.PERF_COMPANY_ID || '')
const argumentsMap = new Map(process.argv.slice(2).map(argument => {
  const [key, value] = argument.replace(/^--/, '').split('=')
  return [key, value]
}))
const concurrency = Math.max(1, Number(argumentsMap.get('concurrency') || process.env.PERF_CONCURRENCY || 20))
const durationSeconds = Math.max(5, Number(argumentsMap.get('duration') || process.env.PERF_DURATION_SECONDS || 30))
const outputPath = String(process.env.PERF_OUTPUT || '')
const configuredEndpoints = String(process.env.PERF_ENDPOINTS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
const endpoints = configuredEndpoints.length
  ? configuredEndpoints
  : token
    ? ['/api/dashboard/metrics?filter=this_month', '/api/leads?page=1&pageSize=20', '/api/conversas?page=1&pageSize=30', '/api/agendamentos?page=1&pageSize=20']
    : ['/api/health']

const latencies = []
const statuses = new Map()
const failures = []
const deadline = Date.now() + durationSeconds * 1000

function percentile(values, percentage) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage) - 1)]
}

async function request(endpoint) {
  const startedAt = performance.now()
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(companyId ? { 'X-Company-Id': companyId } : {}),
      },
    })
    await response.arrayBuffer()
    const elapsed = performance.now() - startedAt
    latencies.push(elapsed)
    statuses.set(response.status, (statuses.get(response.status) || 0) + 1)
    if (!response.ok) failures.push({ endpoint, status: response.status })
  } catch (error) {
    latencies.push(performance.now() - startedAt)
    statuses.set('network', (statuses.get('network') || 0) + 1)
    failures.push({ endpoint, error: error instanceof Error ? error.message : String(error) })
  }
}

async function worker(workerId) {
  let requestNumber = workerId
  while (Date.now() < deadline) {
    const endpoint = endpoints[requestNumber % endpoints.length]
    await request(endpoint)
    requestNumber += concurrency
  }
}

console.log(`Load test: ${concurrency} usuarios por ${durationSeconds}s em ${baseUrl}`)
console.log(`Endpoints: ${endpoints.join(', ')}`)
await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)))

const total = latencies.length
const failed = failures.length
const result = {
  baseUrl,
  concurrency,
  durationSeconds,
  endpoints,
  totalRequests: total,
  requestsPerSecond: Number((total / durationSeconds).toFixed(2)),
  failedRequests: failed,
  errorRate: total ? Number((failed / total).toFixed(4)) : 1,
  latencyMs: {
    average: total ? Number((latencies.reduce((sum, value) => sum + value, 0) / total).toFixed(2)) : 0,
    p50: Number(percentile(latencies, 0.5).toFixed(2)),
    p95: Number(percentile(latencies, 0.95).toFixed(2)),
    p99: Number(percentile(latencies, 0.99).toFixed(2)),
    maximum: total ? Number(Math.max(...latencies).toFixed(2)) : 0,
  },
  statuses: Object.fromEntries(statuses),
  sampleFailures: failures.slice(0, 10),
}

console.log(JSON.stringify(result, null, 2))
if (outputPath) await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')

const p95Limit = Number(process.env.PERF_P95_LIMIT_MS || 800)
const errorRateLimit = Number(process.env.PERF_ERROR_RATE_LIMIT || 0.01)
if (!total || result.errorRate > errorRateLimit || result.latencyMs.p95 > p95Limit) process.exitCode = 1
