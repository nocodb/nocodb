import 'mocha';
import { expect } from 'chai';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import {
  mergeYjsState,
  shouldWriteCollabTitle,
} from '~/commands/documentCollabPersist';
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

  // Fix #2 — the persist must only push the collaborative title back to
  // `nc_docs.title` when it was genuinely edited in the editor since the last
  // persist, so a concurrent REST/sidebar rename is never clobbered.
  describe('documentCollabPersist.shouldWriteCollabTitle', () => {
    const cases: Array<{
      name: string;
      params: Parameters<typeof shouldWriteCollabTitle>[0];
      expected: boolean;
    }> = [
      {
        name: 'in-editor edit that differs from the DB → write',
        params: {
          currentTitle: 'New',
          lastPersistedTitle: 'Old',
          docExists: true,
          dbTitle: 'Old',
        },
        expected: true,
      },
      {
        name: 'external rename (Y.Text unchanged since last persist) → skip',
        params: {
          currentTitle: 'Stale',
          lastPersistedTitle: 'Stale',
          docExists: true,
          dbTitle: 'Renamed',
        },
        expected: false,
      },
      {
        name: 'no change at all → skip',
        params: {
          currentTitle: 'Same',
          lastPersistedTitle: 'Same',
          docExists: true,
          dbTitle: 'Same',
        },
        expected: false,
      },
      {
        name: 'in-editor edit that already matches the DB → skip',
        params: {
          currentTitle: 'Synced',
          lastPersistedTitle: 'Old',
          docExists: true,
          dbTitle: 'Synced',
        },
        expected: false,
      },
      {
        name: 'doc does not exist → skip',
        params: {
          currentTitle: 'New',
          lastPersistedTitle: 'Old',
          docExists: false,
          dbTitle: undefined,
        },
        expected: false,
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        expect(shouldWriteCollabTitle(c.params)).to.equal(c.expected);
      });
    }
  });

  // Fix #4 — a disconnecting socket must reap exactly its own cursors from every
  // peer (no ghost cursors), and only its own.
  describe('DocumentCollabManager awareness cleanup', () => {
    const ctx = { workspace_id: 'w', base_id: 'b' } as any;

    it("reaps a disconnected socket's cursor from every peer", () => {
      const docId = 'aware-doc-1';
      const socketId = 'socket-A';

      // Server-side session — openSession wires the awareness-ownership listener.
      const session = (DocumentCollabManager as any).openSession(
        docId,
        new Y.Doc(),
        ctx,
        false,
      );

      // A client publishes a cursor; encode it like a real client awareness frame.
      const clientDoc = new Y.Doc();
      const clientAwareness = new Awareness(clientDoc);
      clientAwareness.setLocalState({
        user: { name: 'Ada' },
        cursor: { anchor: 1 },
      });
      const clientId = clientDoc.clientID;
      const frame = encodeAwarenessUpdate(clientAwareness, [clientId]);

      // A peer that has already received the cursor.
      const peerDoc = new Y.Doc();
      const peerAwareness = new Awareness(peerDoc);
      applyAwarenessUpdate(peerAwareness, frame, 'remote');
      expect(peerAwareness.getStates().has(clientId)).to.equal(true);

      // The server records cursor ownership for the socket.
      DocumentCollabManager.trackAwareness(docId, socketId, Buffer.from(frame));
      expect(session.awarenessClients.get(clientId)).to.equal(socketId);
      expect(session.awareness.getStates().has(clientId)).to.equal(true);

      // On disconnect, the server builds the removal frame to broadcast.
      const removalB64 = DocumentCollabManager.buildSocketAwarenessRemoval(
        docId,
        socketId,
      );
      expect(removalB64).to.be.a('string');

      // The peer drops the cursor once the removal frame is applied.
      applyAwarenessUpdate(
        peerAwareness,
        new Uint8Array(Buffer.from(removalB64 as string, 'base64')),
        'remote',
      );
      expect(peerAwareness.getStates().has(clientId)).to.equal(false);

      // Ownership is forgotten, so a repeat removal is a no-op.
      expect(session.awarenessClients.has(clientId)).to.equal(false);
      expect(
        DocumentCollabManager.buildSocketAwarenessRemoval(docId, socketId),
      ).to.equal(null);

      clientAwareness.destroy();
      peerAwareness.destroy();
      session.awareness.destroy();
      (DocumentCollabManager as any).sessions.delete(docId);
    });

    it('returns null when the socket / doc owns no cursors', () => {
      const docId = 'aware-doc-2';
      const session = (DocumentCollabManager as any).openSession(
        docId,
        new Y.Doc(),
        ctx,
        false,
      );

      // Unknown doc: no-op, never throws.
      expect(() =>
        DocumentCollabManager.trackAwareness(
          'missing-doc',
          's',
          Buffer.from([]),
        ),
      ).to.not.throw();

      // Known doc, but the socket owns nothing.
      expect(
        DocumentCollabManager.buildSocketAwarenessRemoval(
          docId,
          'ghost-socket',
        ),
      ).to.equal(null);

      session.awareness.destroy();
      (DocumentCollabManager as any).sessions.delete(docId);
    });
  });
}
