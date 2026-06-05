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
 *
 * Gates write-bearing sub-messages for read-only connections at the decode
 * boundary (mirrors Hocuspocus `MessageReceiver.readSyncMessage`): a read-only
 * client may only run SyncStep1 (which just produces the server's state reply).
 * SyncStep2 / Update carry client mutations and are dropped — otherwise a
 * viewer could mutate the shared doc via this channel (the `UPDATE` socket
 * handler already enforces this; this closes the same hole on `SYNC`).
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
      // Read-only safe: only reads the client's state vector and writes the
      // server's missing-updates reply into `enc`.
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
