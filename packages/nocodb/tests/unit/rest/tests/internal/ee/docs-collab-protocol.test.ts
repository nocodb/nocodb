import 'mocha';
import { expect } from 'chai';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import {
  handleSyncMessage,
  encodeSyncStep1,
  encodeUpdate,
  MESSAGE_SYNC,
} from '~/socket/documentSyncProtocol';

function encodeSyncStep2(doc: Y.Doc): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  syncProtocol.writeSyncStep2(enc, doc);
  return encoding.toUint8Array(enc);
}

export function docsCollabProtocolTests() {
  describe('documentSyncProtocol', () => {
    it('syncs a fresh client up to server state', () => {
      const server = new Y.Doc();
      server.getXmlFragment('default').insert(0, [new Y.XmlText('hello')]);
      const client = new Y.Doc();

      // client sends step1 (its empty state vector); server replies step2
      const step1 = encodeSyncStep1(client);
      const reply = handleSyncMessage(server, step1); // Uint8Array | null
      expect(reply).to.be.instanceOf(Uint8Array);

      // applying the reply on the client must converge content
      handleSyncMessage(client, reply!);
      expect(client.getXmlFragment('default').toString()).to.contain('hello');
    });

    it('produces an update frame that applies on a peer', () => {
      const a = new Y.Doc();
      const b = new Y.Doc();

      let captured: Uint8Array | null = null;
      a.on('update', (u: Uint8Array) => {
        captured = u;
      });
      a.getXmlFragment('default').insert(0, [new Y.XmlText('xyz')]);
      expect(captured).to.be.instanceOf(Uint8Array);

      const frame = encodeUpdate(captured!);
      handleSyncMessage(b, frame);
      expect(b.getXmlFragment('default').toString()).to.contain('xyz');
    });

    it('read-only connection cannot mutate the server doc via a sync update frame', () => {
      const server = new Y.Doc();
      server.getXmlFragment('default').insert(0, [new Y.XmlText('seed')]);

      // A malicious read-only client crafts an Update frame.
      const attacker = new Y.Doc();
      let captured: Uint8Array | null = null;
      attacker.on('update', (u: Uint8Array) => {
        captured = u;
      });
      attacker.getXmlFragment('default').insert(0, [new Y.XmlText('HACK')]);

      const frame = encodeUpdate(captured!);

      // readOnly=true → frame must be dropped, server doc unchanged.
      handleSyncMessage(server, frame, 'attacker', true);
      expect(server.getXmlFragment('default').toString()).to.not.contain('HACK');

      // Sanity: the same frame DOES apply without the flag (proves it's valid).
      const writable = new Y.Doc();
      handleSyncMessage(writable, frame, 'attacker', false);
      expect(writable.getXmlFragment('default').toString()).to.contain('HACK');
    });

    it('read-only connection still receives server state (SyncStep1 honored)', () => {
      const server = new Y.Doc();
      server.getXmlFragment('default').insert(0, [new Y.XmlText('hello')]);
      const client = new Y.Doc();

      const step1 = encodeSyncStep1(client);
      const reply = handleSyncMessage(server, step1, 'ro', true); // read-only
      expect(reply).to.be.instanceOf(Uint8Array);

      handleSyncMessage(client, reply!);
      expect(client.getXmlFragment('default').toString()).to.contain('hello');
    });

    it('read-only connection cannot mutate the server doc via a sync step2 frame', () => {
      const server = new Y.Doc();
      server.getXmlFragment('default').insert(0, [new Y.XmlText('seed')]);

      // A malicious read-only client crafts a SyncStep2 frame carrying its own state.
      const attacker = new Y.Doc();
      attacker.getXmlFragment('default').insert(0, [new Y.XmlText('HACK2')]);

      const frame = encodeSyncStep2(attacker);

      // readOnly=true → frame must be dropped, server doc unchanged.
      handleSyncMessage(server, frame, 'attacker', true);
      expect(server.getXmlFragment('default').toString()).to.not.contain('HACK2');

      // Sanity: the same frame DOES apply without the flag (proves it's valid).
      const writable = new Y.Doc();
      handleSyncMessage(writable, frame, 'attacker', false);
      expect(writable.getXmlFragment('default').toString()).to.contain('HACK2');
    });
  });
}
