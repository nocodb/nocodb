/**
 * Compact, URL-safe handoff state for the on-prem → cloud "Buy License" flow.
 *
 * The on-prem instance encodes context (originating URL, seat hint, stable
 * instance id) into a single `state=...` query param. The cloud account/self-hosted
 * page decodes it. base64url JSON is enough — none of these fields are
 * authoritative on their own (Stripe drives the actual charge; instance_id
 * mismatches only lock the user out of their own license), but encoding
 * keeps the URL clean and discourages casual tampering.
 *
 * Bump `v` only on a non-backwards-compatible payload change.
 */
export interface OnPremCheckoutState {
  v: 1
  instance_url?: string
  instance_id?: string
  seat_count?: number
}

const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (b64url: string) => {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = padded.length % 4
  return padLen ? padded + '='.repeat(4 - padLen) : padded
}

export function encodeOnPremCheckoutState(state: OnPremCheckoutState): string {
  const json = JSON.stringify(state)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return toBase64Url(btoa(binary))
}

export function decodeOnPremCheckoutState(encoded: string): OnPremCheckoutState | null {
  try {
    const binary = atob(fromBase64Url(encoded))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const parsed = JSON.parse(new TextDecoder().decode(bytes))
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null

    const result: OnPremCheckoutState = { v: 1 }

    if (typeof parsed.instance_url === 'string' && parsed.instance_url) {
      result.instance_url = parsed.instance_url
    }
    if (typeof parsed.instance_id === 'string' && parsed.instance_id) {
      result.instance_id = parsed.instance_id
    }
    if (typeof parsed.seat_count === 'number' && Number.isFinite(parsed.seat_count) && parsed.seat_count > 0) {
      result.seat_count = Math.floor(parsed.seat_count)
    }

    return result
  } catch {
    return null
  }
}
