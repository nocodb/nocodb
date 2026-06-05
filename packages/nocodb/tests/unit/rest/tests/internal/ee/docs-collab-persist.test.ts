import 'mocha';
import { expect } from 'chai';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import { mergeYjsState } from '~/commands/documentCollabPersist';
import NocoCache from '~/cache/NocoCache';
import { DocumentCollabManager } from '~/socket/DocumentCollabManager';

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
      expect(yDocToProsemirrorJSON(merged, 'default')).to.deep.equal(
        contentJson,
      );

      const again = mergeYjsState(merged, state);
      expect(Buffer.compare(again.state, state)).to.equal(0);
    });
  });

  describe('DocumentCollabManager persist lock', () => {
    const ctx = { workspace_id: 'w', base_id: 'b' } as any;
    let origSet: any;

    before(() => {
      origSet = (NocoCache as any).setIfNotExist;
    });
    after(() => {
      (NocoCache as any).setIfNotExist = origSet;
    });

    it('acquires when the lock key is free', async () => {
      (NocoCache as any).setIfNotExist = async () => true;
      const ok = await (DocumentCollabManager as any).acquirePersistLock(
        ctx,
        'doc1',
      );
      expect(ok).to.equal(true);
    });

    it('does not acquire when another node holds the lock', async () => {
      (NocoCache as any).setIfNotExist = async () => false;
      const ok = await (DocumentCollabManager as any).acquirePersistLock(
        ctx,
        'doc1',
      );
      expect(ok).to.equal(false);
    });

    it('falls back to writer-owner when cache is unavailable (single node)', async () => {
      (NocoCache as any).setIfNotExist = async () => {
        throw new Error('no redis');
      };
      const ok = await (DocumentCollabManager as any).acquirePersistLock(
        ctx,
        'doc1',
      );
      expect(ok).to.equal(true);
    });
  });
}
