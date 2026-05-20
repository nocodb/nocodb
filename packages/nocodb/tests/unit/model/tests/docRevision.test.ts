import 'mocha';
import { expect } from 'chai';
import { DocRevisionSource } from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createDocument } from '../../factory/document';
import type Base from '~/models/Base';
import DocRevision from '~/ee/models/DocRevision';

/**
 * Unit tests for the doc revision history model.
 *
 * Focus is the coalescing logic — the rest (list / get / restore source
 * preservation) is straightforward CRUD.
 *
 * `DEFAULT_COALESCE_WINDOW_MS` is read from `NC_DOC_REVISION_COALESCE_WINDOW_MS`.
 * These tests override the env var per-suite so we can test boundary
 * behaviour deterministically.
 */
function docRevisionTests() {
  let context;
  let ctx: { workspace_id: string; base_id: string };
  let base: Base;
  let originalWindow: string | undefined;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
    originalWindow = process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS;
    } else {
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = originalWindow;
    }
  });

  const sampleContent = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });

  // ── DocRevision.record ──────────────────────────────────────────

  describe('DocRevision.record', () => {
    it('should INSERT the first revision for a doc', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });

      const revId = await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('hello'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      expect(revId).to.be.a('string');

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.have.lengthOf(1);
      expect(list[0].id).to.equal(revId);
      expect(list[0].fk_doc_id).to.equal(doc.id);
      expect(list[0].version).to.equal(1);
      expect(list[0].title).to.equal('Doc');
      expect(list[0].source).to.equal(DocRevisionSource.AUTO);
      expect(list[0].created_by).to.equal('user-1');
    });

    it('should INSERT a second revision for a different author', async () => {
      // Long window so coalescing would fire if author matched.
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '600000';
      const doc = await createDocument(ctx, { title: 'Doc' });

      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('a'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('b'),
        title: 'Doc',
        createdBy: 'user-2',
      });

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.have.lengthOf(2);
      // Newest first
      expect(list[0].created_by).to.equal('user-2');
      expect(list[1].created_by).to.equal('user-1');
    });

    it('should NOT coalesce same-author writes from different tabs', async () => {
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '600000';
      const doc = await createDocument(ctx, { title: 'Doc' });

      await DocRevision.record({ ...ctx, tab_id: 'tab-a' } as any, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('from tab a'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      await DocRevision.record({ ...ctx, tab_id: 'tab-b' } as any, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('from tab b'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.have.lengthOf(2);
      expect(list[0].fk_tab_id).to.equal('tab-b');
      expect(list[1].fk_tab_id).to.equal('tab-a');
    });

    it('should COALESCE same-author writes within the window', async () => {
      // 10-minute window — both writes fall well within.
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '600000';
      const doc = await createDocument(ctx, { title: 'Doc' });

      const firstId = await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('draft'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      const secondId = await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('final'),
        title: 'Doc updated',
        createdBy: 'user-1',
      });

      // Same row updated in place — same id, but latest content/title/version.
      expect(secondId).to.equal(firstId);

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.have.lengthOf(1);

      const fetched = await DocRevision.get(ctx, firstId);
      expect(fetched!.version).to.equal(2);
      expect(fetched!.title).to.equal('Doc updated');
      expect(fetched!.content).to.deep.equal(sampleContent('final'));
    });

    it('should APPEND when the previous revision is older than the window', async () => {
      // 0ms window disables coalescing entirely.
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '0';
      const doc = await createDocument(ctx, { title: 'Doc' });

      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('one'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('two'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.have.lengthOf(2);
    });

    it('should NOT coalesce when the previous revision is a restore', async () => {
      // Even though same author + within window, the prior row was created
      // by a restore — keep it pinned so the timeline shows the milestone.
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '600000';
      const doc = await createDocument(ctx, { title: 'Doc' });

      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('snapshot'),
        title: 'Doc',
        createdBy: 'user-1',
        source: DocRevisionSource.RESTORE,
      });
      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('edited'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.have.lengthOf(2);
      expect(list[0].source).to.equal(DocRevisionSource.AUTO);
      expect(list[1].source).to.equal(DocRevisionSource.RESTORE);
    });

    it('should preserve source=restore on the new revision when restoring', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });

      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('original'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      const restoredId = await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('original'),
        title: 'Doc',
        createdBy: 'user-1',
        source: DocRevisionSource.RESTORE,
      });

      const restored = await DocRevision.get(ctx, restoredId);
      expect(restored!.source).to.equal(DocRevisionSource.RESTORE);
    });
  });

  // ── DocRevision.list ────────────────────────────────────────────

  describe('DocRevision.list', () => {
    beforeEach(() => {
      // Disable coalescing so each record() produces a distinct row.
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '0';
    });

    it('should return revisions newest first', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });

      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('a'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 2,
        content: sampleContent('b'),
        title: 'Doc',
        createdBy: 'user-1',
      });
      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 3,
        content: sampleContent('c'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      const list = await DocRevision.list(ctx, doc.id!);
      expect(list.map((r) => r.version)).to.deep.equal([3, 2, 1]);
    });

    it('should NOT include content in list items', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });
      await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('payload'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      const list = await DocRevision.list(ctx, doc.id!);
      // List rows are lite — content is fetched via .get() instead.
      expect(list[0].content).to.be.undefined;
    });

    it('should honour the limit option', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });
      for (let i = 1; i <= 5; i++) {
        await DocRevision.record(ctx, {
          docId: doc.id!,
          version: i,
          content: sampleContent(`v${i}`),
          title: 'Doc',
          createdBy: 'user-1',
        });
      }

      const list = await DocRevision.list(ctx, doc.id!, { limit: 3 });
      expect(list).to.have.lengthOf(3);
      expect(list.map((r) => r.version)).to.deep.equal([5, 4, 3]);
    });

    it('should return empty array for a doc with no revisions', async () => {
      const doc = await createDocument(ctx, { title: 'Untouched' });
      const list = await DocRevision.list(ctx, doc.id!);
      expect(list).to.be.an('array').with.lengthOf(0);
    });
  });

  // ── DocRevision.get ─────────────────────────────────────────────

  describe('DocRevision.get', () => {
    it('should return a revision with its content', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });
      const inserted = await DocRevision.record(ctx, {
        docId: doc.id!,
        version: 1,
        content: sampleContent('payload'),
        title: 'Doc',
        createdBy: 'user-1',
      });

      const fetched = await DocRevision.get(ctx, inserted.id!);
      expect(fetched).to.not.be.null;
      expect(fetched!.id).to.equal(inserted.id);
      expect(fetched!.content).to.deep.equal(sampleContent('payload'));
    });

    it('should return null for a non-existent id', async () => {
      const fetched = await DocRevision.get(ctx, 'rev_does_not_exist');
      expect(fetched).to.be.null;
    });
  });

  // ── DocRevision.deleteForDoc ────────────────────────────────────

  describe('DocRevision.deleteForDoc', () => {
    it('should delete all revisions for a doc and leave others untouched', async () => {
      process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS = '0';
      const docA = await createDocument(ctx, { title: 'Doc A' });
      const docB = await createDocument(ctx, { title: 'Doc B' });

      await DocRevision.record(ctx, {
        docId: docA.id!,
        version: 1,
        content: sampleContent('a1'),
        title: 'Doc A',
        createdBy: 'user-1',
      });
      await DocRevision.record(ctx, {
        docId: docA.id!,
        version: 2,
        content: sampleContent('a2'),
        title: 'Doc A',
        createdBy: 'user-1',
      });
      await DocRevision.record(ctx, {
        docId: docB.id!,
        version: 1,
        content: sampleContent('b1'),
        title: 'Doc B',
        createdBy: 'user-1',
      });

      await DocRevision.deleteForDoc(ctx, docA.id!);

      expect(await DocRevision.list(ctx, docA.id!)).to.have.lengthOf(0);
      expect(await DocRevision.list(ctx, docB.id!)).to.have.lengthOf(1);
    });
  });
}

export default function () {
  describe('DocRevision', docRevisionTests);
}
