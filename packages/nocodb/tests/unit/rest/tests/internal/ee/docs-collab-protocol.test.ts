import 'mocha';
import { expect } from 'chai';
import * as Y from 'yjs';
import {
  handleSyncMessage,
  encodeSyncStep1,
  encodeUpdate,
} from '~/socket/documentSyncProtocol';

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
  });
}
