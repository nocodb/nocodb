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

/** Apply an inbound sync frame to `doc`. Returns a reply frame, or null. */
export function handleSyncMessage(
  doc: Y.Doc,
  frame: Uint8Array,
  origin: any = 'remote',
): Uint8Array | null {
  const dec = decoding.createDecoder(frame);
  const enc = encoding.createEncoder();
  const messageType = decoding.readVarUint(dec);
  if (messageType !== MESSAGE_SYNC) return null;
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  syncProtocol.readSyncMessage(dec, enc, doc, origin);
  return encoding.length(enc) > 1 ? encoding.toUint8Array(enc) : null;
}

/** Encode an update frame to broadcast to peers. */
export function encodeUpdate(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  syncProtocol.writeUpdate(enc, update);
  return encoding.toUint8Array(enc);
}
