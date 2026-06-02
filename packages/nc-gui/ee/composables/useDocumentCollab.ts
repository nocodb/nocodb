import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { fromBase64, toBase64 } from 'lib0/buffer'
import { DocCollabClientEvents, getDocSyncRoom } from 'nocodb-sdk'

// Mirrors packages/nocodb/src/ee/socket/documentSyncProtocol.ts. Kept private to
// this module so it is not auto-imported into the global Nuxt scope.
const MESSAGE_SYNC = 0

/** Encode a sync step1 (state vector) for `doc`. */
function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MESSAGE_SYNC)
  syncProtocol.writeSyncStep1(enc, doc)
  return encoding.toUint8Array(enc)
}

/** Apply an inbound sync frame to `doc`. Returns a reply frame, or null. */
function handleSyncMessage(doc: Y.Doc, frame: Uint8Array, origin: any): Uint8Array | null {
  const dec = decoding.createDecoder(frame)
  const enc = encoding.createEncoder()
  const messageType = decoding.readVarUint(dec)
  if (messageType !== MESSAGE_SYNC) return null
  encoding.writeVarUint(enc, MESSAGE_SYNC)
  syncProtocol.readSyncMessage(dec, enc, doc, origin)
  return encoding.length(enc) > 1 ? encoding.toUint8Array(enc) : null
}

export interface DocumentCollabUser {
  id: string
  name: string
  color: string
}

export interface UseDocumentCollabParams {
  docId: string
  workspaceId: string
  baseId: string
  user: DocumentCollabUser
}

/**
 * Server-authoritative Yjs collaboration over the existing `$ncSocket` layer.
 *
 * Wire format: all Yjs bytes travel as base64 strings (`$ncSocket.emit` only
 * accepts a plain object, no binary). The handshake is server-initiated — on
 * subscribe the backend emits its SyncStep1; we reply with SyncStep2 and send
 * our own SyncStep1, and both sides converge. Reconnect re-runs the same
 * handshake automatically (the socket plugin re-sends `event:subscribe`), so
 * edits made while offline ride the SyncStep2 reply with no extra work here.
 */
export function useDocumentCollab(params: UseDocumentCollabParams) {
  const { $ncSocket } = useNuxtApp()

  const { docId, workspaceId, baseId, user } = params

  const ydoc = new Y.Doc()

  const awareness = new Awareness(ydoc)
  awareness.setLocalStateField('user', user)

  const synced = ref(false)

  const room = getDocSyncRoom(workspaceId, baseId, docId)

  let ownStep1Sent = false

  let listenerId: string | undefined

  let offReconnect: (() => void) | undefined

  function onRemoteMessage(msg: any) {
    if (!msg) return

    if (msg.kind === 'sync') {
      const reply = handleSyncMessage(ydoc, fromBase64(msg.frame), 'remote')
      if (reply) {
        $ncSocket.emit(DocCollabClientEvents.SYNC, { docId, room, frame: toBase64(reply) })
      }
      if (!ownStep1Sent) {
        // Send our own step1 so the server replies with the content we are missing.
        ownStep1Sent = true
        $ncSocket.emit(DocCollabClientEvents.SYNC, { docId, room, frame: toBase64(encodeSyncStep1(ydoc)) })
      } else if (!reply) {
        // A sync frame that needed no reply, after our step1 → server content applied.
        synced.value = true
      }
    } else if (msg.kind === 'update') {
      Y.applyUpdate(ydoc, fromBase64(msg.update), 'remote')
      synced.value = true
    } else if (msg.kind === 'awareness') {
      applyAwarenessUpdate(awareness, fromBase64(msg.update), 'remote')
    }
  }

  function onLocalUpdate(update: Uint8Array, origin: any) {
    // Skip echoes of updates we just applied from the server.
    if (origin === 'remote') return
    $ncSocket.emit(DocCollabClientEvents.UPDATE, { docId, room, update: toBase64(update) })
  }

  function onLocalAwareness({ added, updated, removed }: any, origin: any) {
    if (origin === 'remote') return
    const changed = [...added, ...updated, ...removed]
    const payload = encodeAwarenessUpdate(awareness, changed)
    $ncSocket.emit(DocCollabClientEvents.AWARENESS, { docId, room, update: toBase64(payload) })
  }

  function destroy() {
    // Announce departure so peers drop our cursor immediately (fires a local
    // awareness 'update' that onLocalAwareness broadcasts before we detach).
    awareness.setLocalState(null)
    ydoc.off('update', onLocalUpdate)
    awareness.off('update', onLocalAwareness)
    if (listenerId) $ncSocket.offMessage(listenerId)
    offReconnect?.()
    awareness.destroy()
    ydoc.destroy()
  }

  listenerId = $ncSocket.onMessage(room, onRemoteMessage)
  ydoc.on('update', onLocalUpdate)
  awareness.on('update', onLocalAwareness)

  offReconnect = $ncSocket.on('reconnect', () => {
    // The plugin re-sends event:subscribe on reconnect → the backend re-emits
    // its step1. Reset handshake state so we re-converge from scratch.
    ownStep1Sent = false
    synced.value = false
  })

  onScopeDispose(destroy)

  return { ydoc, awareness, synced, destroy }
}
