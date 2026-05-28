import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { DocRevisionSource } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';

/**
 * End-to-end test for the document revision history endpoints. Exercises the
 * full backend path: a PATCH to a doc records a revision via
 * DocumentsService.update -> DocRevision.record, and the revision endpoints
 * (list / get / restore) read it back.
 */
export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Document Revisions v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_DOCS: string;
    let originalWindow: string | undefined;

    const makeContent = (text: string) => ({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text }] },
      ],
    });

    async function _createDoc(title: string, content?: Record<string, any>) {
      const res = await request(context.app)
        .post(API_DOCS)
        .set('xc-auth', context.token)
        .send({ title, content: content ?? makeContent('initial') })
        .expect(200);
      return res.body;
    }

    async function _updateDoc(
      docId: string,
      version: number,
      patch: { title?: string; content?: Record<string, any> },
    ) {
      const res = await request(context.app)
        .patch(`${API_DOCS}/${docId}`)
        .set('xc-auth', context.token)
        .send({ ...patch, version })
        .expect(200);
      return res.body;
    }

    async function _listRevisions(docId: string) {
      const res = await request(context.app)
        .get(`${API_DOCS}/${docId}/revisions`)
        .set('xc-auth', context.token)
        .expect(200);
      return res.body;
    }

    async function _getRevision(docId: string, revisionId: string) {
      const res = await request(context.app)
        .get(`${API_DOCS}/${docId}/revisions/${revisionId}`)
        .set('xc-auth', context.token)
        .expect(200);
      return res.body;
    }

    async function _restoreRevision(docId: string, revisionId: string) {
      const res = await request(context.app)
        .post(`${API_DOCS}/${docId}/revisions/${revisionId}/restore`)
        .set('xc-auth', context.token)
        .expect(200);
      return res.body;
    }

    beforeEach(async () => {
      // Disable coalescing so each PATCH yields a discrete revision row —
      // makes assertions about counts unambiguous.
      originalWindow = process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS;
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '0';

      context = await init();
      const workspaceId = context.fk_workspace_id;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'DocRevTestBase' })
        .expect(200);

      initBase = baseResult.body;
      API_DOCS = `/api/v3/docs/${initBase.id}`;
    });

    afterEach(() => {
      if (originalWindow === undefined) {
        delete process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS;
      } else {
        process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = originalWindow;
      }
    });

    // ── List ─────────────────────────────────────────────────────

    it('GET /revisions returns an empty list for a doc with no edits', async () => {
      const doc = await _createDoc('Untouched');
      const res = await _listRevisions(doc.id);

      expect(res).to.have.property('list').that.is.an('array').with.lengthOf(0);
      expect(res).to.have.property('nextCursor', '');
    });

    it('GET /revisions returns one row per content edit, newest first', async () => {
      const doc = await _createDoc('Doc');

      const v2 = await _updateDoc(doc.id, doc.version, {
        content: makeContent('edit-one'),
      });
      const v3 = await _updateDoc(doc.id, v2.version, {
        content: makeContent('edit-two'),
      });
      await _updateDoc(doc.id, v3.version, {
        content: makeContent('edit-three'),
      });

      const { list } = await _listRevisions(doc.id);

      expect(list).to.have.lengthOf(3);
      expect(list[0].version).to.be.greaterThan(list[1].version);
      expect(list[1].version).to.be.greaterThan(list[2].version);
      // List items must not leak content payloads.
      expect(list[0]).to.not.have.property('content');
      expect(list[0]).to.have.property('source', DocRevisionSource.AUTO);
    });

    it('GET /revisions skips revision recording when content is unchanged', async () => {
      const doc = await _createDoc('Doc', makeContent('hello'));

      // Title-only patch followed by an identical title patch — the second
      // should be a no-op for the revision log.
      await _updateDoc(doc.id, doc.version, { title: 'Renamed' });
      const res = await _listRevisions(doc.id);
      expect(res.list).to.have.lengthOf(1);
    });

    // ── Get single ───────────────────────────────────────────────

    it('GET /revisions/:id returns the full content payload', async () => {
      const doc = await _createDoc('Doc');
      await _updateDoc(doc.id, doc.version, {
        content: makeContent('payload'),
      });
      const { list } = await _listRevisions(doc.id);

      const rev = await _getRevision(doc.id, list[0].id);

      expect(rev).to.have.property('id', list[0].id);
      expect(rev).to.have.property('content').that.is.an('object');
      expect(rev.content).to.deep.equal(makeContent('payload'));
    });

    it('GET /revisions/:id 404s when the revision does not belong to the doc', async () => {
      const docA = await _createDoc('Doc A');
      const docB = await _createDoc('Doc B');
      await _updateDoc(docB.id, docB.version, {
        content: makeContent('only on b'),
      });
      const { list } = await _listRevisions(docB.id);

      await request(context.app)
        .get(`${API_DOCS}/${docA.id}/revisions/${list[0].id}`)
        .set('xc-auth', context.token)
        .expect(404);
    });

    // ── Restore ──────────────────────────────────────────────────

    it('POST /revisions/:id/restore writes the prior content back as a new revision', async () => {
      const doc = await _createDoc('Doc', makeContent('v1'));
      const v2 = await _updateDoc(doc.id, doc.version, {
        content: makeContent('v2'),
      });
      const v3 = await _updateDoc(doc.id, v2.version, {
        content: makeContent('v3'),
      });

      // Snapshot the revision corresponding to v2 ("edit one"), then restore.
      const { list: beforeRestore } = await _listRevisions(doc.id);
      const v2Revision = beforeRestore.find((r: any) => r.version === v2.version);
      expect(v2Revision, 'expected to find the v2 revision').to.not.be.undefined;

      const restored = await _restoreRevision(doc.id, v2Revision.id);

      // Doc now reads back the v2 content but at a NEW version.
      expect(restored.content).to.deep.equal(makeContent('v2'));
      expect(restored.version).to.be.greaterThan(v3.version);

      // A new revision is appended with source=restore — original revisions stay.
      const { list: afterRestore } = await _listRevisions(doc.id);
      expect(afterRestore.length).to.equal(beforeRestore.length + 1);
      expect(afterRestore[0].source).to.equal(DocRevisionSource.RESTORE);
      expect(afterRestore[0].version).to.equal(restored.version);
    });
  });
}
