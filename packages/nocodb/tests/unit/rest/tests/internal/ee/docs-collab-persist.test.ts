import 'mocha';
import { expect } from 'chai';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import { mergeYjsState } from '~/commands/documentCollabPersist';

export function docsCollabPersistTests() {
  describe('documentCollabPersist.mergeYjsState', () => {
    it('merges DB state into in-memory and is idempotent', () => {
      const a = new Y.Doc();
      a.getXmlFragment('default').insert(0, [new Y.XmlText('A')]);
      const b = new Y.Doc();
      b.getXmlFragment('default').insert(0, [new Y.XmlText('B')]);

      const dbState = Buffer.from(Y.encodeStateAsUpdate(b)); // simulate concurrent peer write
      const { state, contentJson } = mergeYjsState(a, dbState);

      // merged doc contains both contributions; state re-encodes deterministically
      const merged = new Y.Doc();
      Y.applyUpdate(merged, state);
      expect(yDocToProsemirrorJSON(merged, 'default')).to.deep.equal(contentJson);

      const again = mergeYjsState(merged, state);
      expect(Buffer.compare(again.state, state)).to.equal(0);
    });
  });
}

// Invoke the suite when loaded directly by the mocha CLI
docsCollabPersistTests();
