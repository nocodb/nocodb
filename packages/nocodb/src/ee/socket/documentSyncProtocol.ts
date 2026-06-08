import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;

/** Encode a sync step1 (state vector) for `doc`. */
export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(enc, doc);
  return encoding.toUint8Array(enc);
}

/**
 * Apply an inbound sync frame to `doc`. Returns a reply frame, or null.
 * Read-only connections may only run SyncStep1; SyncStep2/Update carry client
 * mutations and are dropped (mirrors Hocuspocus MessageReceiver).
 */
export function handleSyncMessage(
  doc: Y.Doc,
  frame: Uint8Array,
  origin: any = 'remote',
  readOnly = false,
): Uint8Array | null {
  const dec = decoding.createDecoder(frame);
  const enc = encoding.createEncoder();
  const messageType = decoding.readVarUint(dec);
  if (messageType !== MESSAGE_SYNC) return null;
  encoding.writeVarUint(enc, MESSAGE_SYNC);

  const syncMessageType = decoding.readVarUint(dec);
  switch (syncMessageType) {
    case syncProtocol.messageYjsSyncStep1:
      syncProtocol.readSyncStep1(dec, enc, doc);
      break;
    case syncProtocol.messageYjsSyncStep2:
      if (!readOnly) syncProtocol.readSyncStep2(dec, doc, origin);
      break;
    case syncProtocol.messageYjsUpdate:
      if (!readOnly) syncProtocol.readUpdate(dec, doc, origin);
      break;
    default:
      break;
  }
  return encoding.length(enc) > 1 ? encoding.toUint8Array(enc) : null;
}

/** Encode an update frame to broadcast to peers. */
export function encodeUpdate(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  syncProtocol.writeUpdate(enc, update);
  return encoding.toUint8Array(enc);
}
