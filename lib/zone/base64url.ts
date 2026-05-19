/** URL-safe base64 — works in browser and Node (Buffer 'base64url' is Node-only). */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  if (typeof btoa === 'function') return btoa(binary)
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const padded = normalized + pad
  let binary: string
  if (typeof atob === 'function') {
    binary = atob(padded)
  } else {
    binary = Buffer.from(padded, 'base64').toString('binary')
  }
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function encodeUtf8Base64Url(text: string, maxLen = 36): string {
  const bytes = new TextEncoder().encode(text.trim())
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, maxLen)
}

export function decodeUtf8Base64Url(token: string): string {
  const t = token.trim()
  if (!t) return ''
  try {
    return new TextDecoder().decode(base64ToBytes(t))
  } catch {
    return t
  }
}
