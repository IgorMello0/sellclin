import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib'
import { isPublicAddress, requestPinned } from './public-download.js'

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
const MAX_REQUEST_BYTES = 20 * 1024 * 1024
type Address = { address: string; family: number }
type Dependencies = { lookup: (host: string) => Promise<Address[]>; request: typeof requestPinned }

// Only the VPS operator can authorize private services or nonstandard ports.
// Clinic-controlled configuration must never grant this exception.
export function trustedIntegrationOrigins(env: NodeJS.ProcessEnv = process.env) {
  return (env.TRUSTED_INTEGRATION_ORIGINS || '').split(',').filter(value => value.trim()).map(value => {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('TRUSTED_INTEGRATION_ORIGINS deve conter somente origens completas')
    }
    return url.origin
  })
}

export async function resolveIntegrationTarget(value: string | URL, resolve = (host: string) => lookup(host, { all: true, verbatim: true }), trusted = trustedIntegrationOrigins()) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('URL de integração não permitida')
  const operatorApproved = trusted.includes(url.origin)
  if (!operatorApproved && (url.protocol !== 'https:' || url.port)) throw new Error('Integração exige HTTPS na porta padrão ou origem autorizada na VPS')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host)
  if (!addresses.length || addresses.some(item => !isIP(item.address) || (!operatorApproved && !isPublicAddress(item.address)))) {
    throw new Error('Endereço de integração não permitido')
  }
  return { url, address: addresses[0] }
}

export async function fetchIntegration(value: string | URL, init: RequestInit = {}, dependencies: Dependencies = {
  lookup: host => lookup(host, { all: true, verbatim: true }), request: requestPinned,
}): Promise<Response> {
  const signal = AbortSignal.any([AbortSignal.timeout(30_000), ...(init.signal ? [init.signal] : [])])
  signal.throwIfAborted()
  const bounded = async <T>(operation: Promise<T>) => {
    let abort: () => void
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
    try { return await Promise.race([operation, cancelled]) }
    finally { signal.removeEventListener('abort', abort!) }
  }
  const target = await bounded(resolveIntegrationTarget(value, dependencies.lookup))
  const request = new Request(target.url, { ...init, signal })
  const body = request.body ? Buffer.from(await bounded(request.arrayBuffer())) : undefined
  if (body && body.length > MAX_REQUEST_BYTES) throw new Error('Requisição de integração excede o limite permitido')
  const headers = Object.fromEntries(request.headers.entries())
  headers['accept-encoding'] = 'identity'
  delete headers.host
  delete headers['content-length']
  const result = await bounded(dependencies.request(target.url, target.address, {
    maxBytes: MAX_RESPONSE_BYTES, timeoutMs: 30_000, headers, method: request.method, body, signal,
  }))
  // Do not replay authenticated requests or write operations at another URL.
  if (result.status >= 300 && result.status < 400) throw new Error('Redirecionamento de integração não permitido')
  let buffer = result.buffer
  const encoding = result.headers['content-encoding']?.toLowerCase()
  const decode = { gzip: gunzipSync, deflate: inflateSync, br: brotliDecompressSync }[encoding || '']
  if (decode) buffer = decode(buffer, { maxOutputLength: MAX_RESPONSE_BYTES })
  else if (encoding && encoding !== 'identity') throw new Error('Codificação de integração não permitida')
  const responseHeaders = new Headers()
  for (const [key, values] of Object.entries(result.headers)) {
    if (values === undefined || ['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) continue
    for (const v of Array.isArray(values) ? values : [String(values)]) responseHeaders.append(key, v)
  }
  const response = new Response([204, 205, 304].includes(result.status) || request.method === 'HEAD' ? null : buffer, { status: result.status, headers: responseHeaders })
  Object.defineProperty(response, 'url', { value: target.url.toString() })
  return response
}

// Exposed as an object so tests can replace the transport without real providers.
export const integrationHttpClient = { fetch: fetchIntegration }
