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

  // Server-granted right to seed an empty (legacy) doc into the CRDT. Set from
  // the server-initiated handshake — at most one editor across the cluster is
  // granted, so two clients can't seed the same content concurrently (which Yjs
  // would merge into duplicated body/title content). Read-only clients are never
  // granted (their seed couldn't persist anyway).
  const mayBootstrap = ref(false)

  const room = getDocSyncRoom(workspaceId, baseId, docId)

  let ownStep1Sent = false

  let listenerId: string | undefined

  let offReconnect: (() => void) | undefined

  let destroyed = false

  // Safety net for a missed handshake frame. The `synced` flip depends on the
  // server's step1/step2 frames arriving; a subscribe/reconnect timing race can
  // drop one, which would otherwise leave the editor stuck read-only
  // (`contenteditable=false` → no caret, though toolbar commands still apply).
  // If we haven't converged in time, re-request the server's state and unblock
  // the editor regardless — any content that arrives afterwards merges via CRDT.
  const SYNC_FALLBACK_MS = 4000

  let syncFallback: ReturnType<typeof setTimeout> | undefined

  function armSyncFallback() {
    if (syncFallback) clearTimeout(syncFallback)
    syncFallback = setTimeout(() => {
      if (destroyed || synced.value) return
      ownStep1Sent = true
      $ncSocket.emit(DocCollabClientEvents.SYNC, { docId, room, frame: toBase64(encodeSyncStep1(ydoc)) })
      synced.value = true
    }, SYNC_FALLBACK_MS)
  }

  function onRemoteMessage(msg: any) {
    if (!msg) return

    // A malformed/incompatible frame (e.g. surrogate-pair edge cases in the Yjs
    // decoder) can throw mid-apply. Isolate it so one bad frame can't tear down
    // the editor — the reconnect handshake re-syncs from scratch if we drift.
    try {
      if (msg.kind === 'sync') {
        // The server-initiated step1 carries the single-seeder grant. Only the
        // first frame sets it; subsequent sync replies omit the field.
        if (typeof msg.mayBootstrap === 'boolean') mayBootstrap.value = msg.mayBootstrap
        const reply = handleSyncMessage(ydoc, fromBase64(msg.frame), 'remote')
        if (reply) {
          $ncSocket.emit(DocCollabClientEvents.SYNC, { docId, room, frame: toBase64(reply) })
        }
        if (!ownStep1Sent) {
          // Send our own step1 so the server replies with the content we are missing.
          ownStep1Sent = true
          $ncSocket.emit(DocCollabClientEvents.SYNC, { docId, room, frame: toBase64(encodeSyncStep1(ydoc)) })
        } else {
          // Any sync frame received after we've sent our own step1 is the server's
          // reply to it — we now hold the server's state and are converged. Don't
          // gate on `!reply`: a frame that still needs a counter-reply (e.g. a
          // re-issued step1) equally means the server answered, so flipping here
          // is strictly more robust than waiting for a no-reply frame.
          synced.value = true
        }
      } else if (msg.kind === 'update') {
        Y.applyUpdate(ydoc, fromBase64(msg.update), 'remote')
        synced.value = true
      } else if (msg.kind === 'awareness') {
        applyAwarenessUpdate(awareness, fromBase64(msg.update), 'remote')
      }
    } catch {
      // Non-actionable for the user; dropping the frame is safer than crashing
      // the ProseMirror view. Subsequent updates / reconnect restore currency.
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
    // Idempotent: teardown may be invoked from more than one path (component
    // unmount, onScopeDispose, or an explicit caller). Running it twice would
    // re-detach already-removed listeners and double-destroy the Y.Doc.
    if (destroyed) return
    destroyed = true
    if (syncFallback) clearTimeout(syncFallback)
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
  armSyncFallback()

  // Proactively request the server's state with our own SyncStep1 instead of
  // relying solely on the server's subscribe-triggered step1. When the same doc
  // is re-opened on a still-connected socket the plugin skips re-sending
  // `event:subscribe` (the room is already in its subscribed set), so the server
  // never re-emits its step1 — convergence would otherwise stall until the
  // fallback timer fires (a multi-second read-only window on every re-open).
  // No-op while the socket is still connecting on first load, where the buffered
  // `event:subscribe` triggers the server's step1, so this is purely additive.
  $ncSocket.emit(DocCollabClientEvents.SYNC, { docId, room, frame: toBase64(encodeSyncStep1(ydoc)) })

  offReconnect = $ncSocket.on('reconnect', () => {
    // The plugin re-sends event:subscribe on reconnect → the backend re-emits
    // its step1. Reset handshake state so we re-converge from scratch.
    ownStep1Sent = false
    synced.value = false
    armSyncFallback()
  })

  onScopeDispose(destroy)

  return { ydoc, awareness, synced, mayBootstrap, destroy }
}
