import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

// Telemetry only goes out signed in. Auth and invite-link events fire before that, so they wait here
// (persisted: Google/SSO sign-in leaves the page) and go out with the user who signs in. Others are dropped:
// a public shared view must not land on whoever signs in next on that browser.
const HELD_EVENT = /^[ac]:(auth|signin|invite|base:invite|ws:invite):/

const HELD_LIMIT = 50

const HELD_TTL_MS = 24 * 60 * 60 * 1000

function readHeldTele(key: string): Record<string, any>[] {
  try {
    const events = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(events) ? events.filter((e) => Date.now() - e?.held_at < HELD_TTL_MS) : []
  } catch {
    return []
  }
}

export function holdSignedOutTele(key: string, events: Record<string, any>[]) {
  const toHold = events.filter((e) => HELD_EVENT.test(e?.event ?? ''))
  if (!toHold.length) return

  try {
    const held = [...readHeldTele(key), ...toHold.map((e) => ({ ...e, held_at: Date.now() }))].slice(-HELD_LIMIT)
    localStorage.setItem(key, JSON.stringify(held))
  } catch {
    // storage unavailable — the events are lost, as before
  }
}

export function takeSignedOutTele(key: string): Record<string, any>[] {
  const held = readHeldTele(key)

  try {
    localStorage.removeItem(key)
  } catch {}

  return held.map(({ held_at: _heldAt, ...event }) => event)
}

const SOCKET_HELD_KEY = 'nc_tele_held_socket'

/**
 * Socket.io based telemetry transport.
 * Used by CE plugin directly and by EE plugin for free/unlicensed users.
 *
 * Events are sent to SocketGateway → Tele → telemetry.nocodb.com
 */
export class SocketTele {
  private socket: Socket | null = null

  async init(token: string, ncSiteUrl: string) {
    try {
      if (this.socket) this.socket.disconnect()

      const url = new URL(ncSiteUrl || '', window.location.href.split(/[?#]/)[0])
      let socketPath = url.pathname
      socketPath += socketPath.endsWith('/') ? 'socket.io' : '/socket.io'

      this.socket = io(url.href, {
        extraHeaders: { 'xc-auth': token },
        path: socketPath,
      })

      this.socket.on('connect_error', () => {
        this.socket?.disconnect()
      })

      // socket.io buffers these until the connection is up
      for (const payload of takeSignedOutTele(SOCKET_HELD_KEY)) this.socket.emit('event', payload)
    } catch {}
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  emit(event: string, data: Record<string, any>) {
    const payload = { event, ...(data || {}) }

    // no socket until sign-in
    if (this.socket) this.socket.emit('event', payload)
    else holdSignedOutTele(SOCKET_HELD_KEY, [payload])
  }

  emitPage(path: string, pid: string | undefined) {
    if (this.socket) {
      this.socket.emit('page', { path, pid })
    }
  }

  get connected() {
    return !!this.socket
  }
}
