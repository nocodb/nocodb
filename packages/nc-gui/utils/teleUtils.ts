import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

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
    } catch {}
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  emit(event: string, data: Record<string, any>) {
    if (this.socket) {
      this.socket.emit('event', {
        event,
        ...(data || {}),
      })
    }
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
