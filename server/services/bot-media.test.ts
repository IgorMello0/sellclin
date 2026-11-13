import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resolveBotMedia, MAX_BOT_MEDIA_BYTES, botMediaDependencies } from './bot-media.js'
import { verifyMediaLink } from './media-access.js'

afterEach(() => vi.unstubAllEnvs())
let deps: any, db: any
beforeEach(() => {
  vi.stubEnv('UAZAPI_API_URL', 'https://provider.example.com')
  deps = { read: vi.fn().mockResolvedValue(Buffer.from('synthetic file fixture')),
    fetch: vi.fn().mockImplementation(async () => Response.json({ fileURL: 'https://files.example.com/decoded.mp3', mimetype: 'audio/mpeg' })),
    download: vi.fn().mockResolvedValue({ headers: { 'content-type': 'audio/mpeg' }, buffer: Buffer.from('synthetic audio fixture') }), write: vi.fn(),
  }
  db = { empresa: { findUnique: vi.fn().mockResolvedValue({ whatsappProvider: 'uazapi', uazapiToken: 'provider-test-secret' }) } }
})
it('signs Meta media for its clinic without exposing provider credentials', async () => {
  const media = await resolveBotMedia({ rawJson: { mediaType: 'audio', mediaUrl: '/uploads/media/2/voice.ogg' } }, 2, db, deps)
  const url = new URL(media!.content_url)
  expect(media).toMatchObject({ content_type: 'audio', mime_type: 'audio/ogg', file_name: 'voice.ogg' })
  expect(verifyMediaLink(url.pathname, url.searchParams.get('expires'), url.searchParams.get('mediaSignature'))).toBe(true)
  expect(db.empresa.findUnique).not.toHaveBeenCalled()
  expect(deps.fetch).not.toHaveBeenCalled()
})
it('rejects a stored file from another clinic before downloading anything', async () => {
  await expect(resolveBotMedia({ rawJson: { mediaType: 'audio', mediaUrl: '/uploads/media/9/voice.ogg' } }, 2, db, deps)).rejects.toThrow('wrong_clinic')
  expect(deps.fetch).not.toHaveBeenCalled()
})
it('downloads decrypted Uazapi audio as MP3 and gives n8n only a signed local copy', async () => {
  const media = await resolveBotMedia({ providerMessageId: 'message-1', rawJson: { message: { id: 'full-provider-id', messageType: 'AudioMessage' } } }, 2, db, deps)
  const [url, request] = deps.fetch.mock.calls[0]
  expect(url).toBe('https://provider.example.com/message/download')
  expect(request.headers.token).toBe('provider-test-secret')
  expect(JSON.parse(request.body)).toMatchObject({ id: 'full-provider-id', return_link: true, return_base64: false, generate_mp3: true })
  expect(deps.download).toHaveBeenCalledWith('https://files.example.com/decoded.mp3', expect.objectContaining({ httpsOnly: true, maxBytes: MAX_BOT_MEDIA_BYTES }))
  expect(media).toMatchObject({ content_type: 'audio', mime_type: 'audio/mpeg' })
  expect(media!.content_url).toContain('/uploads/media/2/')
  expect(media!.content_url).toContain('mediaSignature=')
  expect(JSON.stringify(media)).not.toContain('provider-test-secret')
  expect(JSON.stringify(media)).not.toContain('files.example.com')
  expect(Buffer.from(media!.base64, 'base64')).toEqual(Buffer.from('synthetic audio fixture'))
  expect(media!.encoding).toBe('base64')
  expect(deps.write).toHaveBeenCalledTimes(1)
})
it('does not forward encrypted media to the workflow', async () => {
  deps.download.mockResolvedValue({ headers: { 'content-type': 'application/octet-stream' }, buffer: Buffer.from('encrypted bytes') })
  await expect(resolveBotMedia({ rawJson: { message: { id: 'a', messageType: 'AudioMessage' } } }, 2, db, deps)).rejects.toThrow('invalid_type')
  expect(deps.write).not.toHaveBeenCalled()
})
it('treats plain text as text without consulting the provider', async () => {
  expect(await resolveBotMedia({ rawJson: { message: { messageType: 'Conversation' } } }, 2, db, deps)).toBeNull()
  expect(deps.fetch).not.toHaveBeenCalled()
})

it('enforces the media byte limit before storing a provider download', async () => {
  deps.download.mockResolvedValue({ headers: { 'content-type': 'audio/mpeg' }, buffer: Buffer.alloc(MAX_BOT_MEDIA_BYTES + 1) })
  await expect(resolveBotMedia({ rawJson: { message: { id: 'a', messageType: 'AudioMessage' } } }, 2, db, deps)).rejects.toThrow('invalid_type')
  expect(deps.write).not.toHaveBeenCalled()
})

it.each([
  ['audio', 'voice.ogg', 'audio/ogg', 'audio'],
  ['image', 'photo.png', 'image/png', 'image'],
  ['video', 'video.mp4', 'video/mp4', 'video'],
  ['image', 'sticker.webp', 'image/webp', 'sticker'],
  ['document', 'document.pdf', 'application/pdf', 'document'],
])('encodes stored %s media as actual Base64 with the right type and MIME', async (kind, file, mime, expectedType) => {
  const rawJson = { mediaType: kind, mediaUrl: `/uploads/media/2/${file}`, ...(expectedType === 'sticker' ? { providerMediaType: 'sticker' } : {}) }
  const media = await resolveBotMedia({ rawJson }, 2, db, deps)
  expect(media).toMatchObject({ content_type: expectedType, mime_type: mime, encoding: 'base64', file_size: Buffer.byteLength('synthetic file fixture') })
  expect(Buffer.from(media!.base64, 'base64').toString()).toBe('synthetic file fixture')
  expect(deps.read).toHaveBeenCalledWith(expect.stringContaining(`/uploads/media/2/${file}`))
  expect(deps.fetch).not.toHaveBeenCalled()
})
it('rejects a stored file over the Base64 limit without truncating it', async () => {
  deps.read.mockResolvedValue(Buffer.alloc(MAX_BOT_MEDIA_BYTES + 1))
  await expect(resolveBotMedia({ rawJson: { mediaType: 'audio', mediaUrl: '/uploads/media/2/voice.ogg' } }, 2, db, deps)).rejects.toThrow('too_large')
})
it('preserves PDF and sticker types when downloading from Uazapi', async () => {
  for (const [messageType, mime, content_type] of [['DocumentMessage', 'application/pdf', 'document'], ['StickerMessage', 'image/webp', 'sticker']]) {
    deps.download.mockResolvedValue({ headers: { 'content-type': mime }, buffer: Buffer.from('decoded fixture') })
    const media = await resolveBotMedia({ rawJson: { message: { id: 'media-id', messageType } } }, 2, db, deps)
    expect(media!.content_type).toBe(content_type)
    expect(Buffer.from(media!.base64, 'base64').toString()).toBe('decoded fixture')
  }
})

it('reads the exact stored bytes and rejects symbolic links at the disk boundary', async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'sellclin-base64-'))
  try {
    const file = path.join(directory, 'file.ogg')
    const link = path.join(directory, 'link.ogg')
    const bytes = Buffer.from([0, 255, 128, 10, 13, 3])
    await fs.writeFile(file, bytes)
    await fs.symlink(file, link)
    expect(await botMediaDependencies.read(file)).toEqual(bytes)
    await expect(botMediaDependencies.read(link)).rejects.toThrow()
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})
