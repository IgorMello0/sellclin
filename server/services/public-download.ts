import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import http from 'node:http'
import https from 'node:https'

type Address = { address: string; family: number }
type DownloadResult = { status: number; headers: http.IncomingHttpHeaders; buffer: Buffer }
type DownloadOptions = { maxBytes: number; timeoutMs?: number; headers?: Record<string, string>; allowedHosts?: readonly string[]; httpsOnly?: boolean; method?: string; body?: Buffer; signal?: AbortSignal }
type Dependencies = { lookup: (hostname: string) => Promise<Address[]>; request: typeof requestPinned }

const blocked = new BlockList()
for (const [ip, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(ip, prefix, 'ipv4')
const globalIPv6 = new BlockList()
globalIPv6.addSubnet('2000::', 3, 'ipv6')
for (const [ip, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]] as const) blocked.addSubnet(ip, prefix, 'ipv6')

export function isPublicAddress(address: string) {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) return globalIPv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
  return false
}

export async function resolveDownloadTarget(value: string, lookupHost = (hostname: string) => lookup(hostname, { all: true, verbatim: true }), allowedHosts?: readonly string[]) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('URL de mídia não permitida')
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (allowedHosts && !allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) throw new Error('Origem de mídia não permitida')
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookupHost(hostname)
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Endereço de mídia não permitido')
  return { url, address: addresses[0] }
}

export function requestPinned(url: URL, address: Address, options: DownloadOptions): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const request = transport.request(url, {
      method: options.method || 'GET', headers: options.headers,
      // Pin the validated address so the transport cannot resolve a different IP.
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      family: address.family,
      agent: false,
    }, response => {
      response.on('error', reject)
      response.on('aborted', () => reject(new Error('Download de mídia interrompido')))
      const status = response.statusCode || 500
      if (status >= 300 && status < 400) {
        response.destroy()
        resolve({ status, headers: response.headers, buffer: Buffer.alloc(0) })
        return
      }
      const declaredSize = Number(response.headers['content-length'] || 0)
      if (declaredSize > options.maxBytes) {
        const error = new Error('Mídia excede o limite permitido')
        reject(error)
        response.destroy(error)
        return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      response.on('data', chunk => {
        bytes += chunk.length
        if (bytes > options.maxBytes) {
          const error = new Error('Mídia excede o limite permitido')
          reject(error)
          response.destroy(error)
          return
        }
        chunks.push(Buffer.from(chunk))
      })
      response.on('end', () => resolve({ status, headers: response.headers, buffer: Buffer.concat(chunks) }))
    })
    const timer = setTimeout(() => {
      const error = new Error('Tempo limite ao baixar mídia')
      reject(error)
      request.destroy(error)
    }, options.timeoutMs || 30_000)
    request.on('upgrade', (_response, socket) => { socket.destroy(); reject(new Error('Protocolo de download inválido')) })
    request.on('error', reject)
    const abort = () => request.destroy(options.signal?.reason instanceof Error ? options.signal.reason : new Error('Requisição cancelada'))
    request.on('close', () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort) })
    if (options.signal?.aborted) abort()
    else options.signal?.addEventListener('abort', abort, { once: true })
    request.end(options.body)
  })
}

export async function downloadPublicMedia(value: string, options: DownloadOptions, dependencies: Dependencies = {
  lookup: hostname => lookup(hostname, { all: true, verbatim: true }), request: requestPinned,
}) {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) throw new Error('Limite de download inválido')
  const deadline = Date.now() + (options.timeoutMs || 30_000)
  let current = value
  let headers = options.headers
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (options.httpsOnly && new URL(current).protocol !== 'https:') throw new Error('Mídia autenticada exige HTTPS')
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Tempo limite ao baixar mídia')
    let timer: ReturnType<typeof setTimeout> | undefined
    const target = await Promise.race([
      resolveDownloadTarget(current, dependencies.lookup, options.allowedHosts),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Tempo limite ao resolver mídia')), remaining) }),
    ]).finally(() => { if (timer) clearTimeout(timer) })
    const result = await dependencies.request(target.url, target.address, { ...options, headers, timeoutMs: Math.max(1, deadline - Date.now()) })
    if (result.status >= 300 && result.status < 400) {
      if (!result.headers.location || redirects === 3) throw new Error('Redirecionamento de mídia inválido')
      const next = new URL(result.headers.location, target.url)
      if (target.url.protocol === 'https:' && next.protocol !== 'https:') throw new Error('Redirecionamento inseguro de mídia')
      if (next.origin !== target.url.origin) headers = undefined // Never leak provider credentials across origins.
      current = next.toString()
      continue
    }
    if (result.status < 200 || result.status >= 300) throw new Error(`Não foi possível baixar mídia (HTTP ${result.status})`)
    return result
  }
  throw new Error('Redirecionamento de mídia inválido')
}

export const publicMediaClient = { download: downloadPublicMedia }
