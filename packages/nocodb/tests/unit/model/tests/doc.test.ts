import 'mocha';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createDoc } from '../../factory/doc';
import type Base from '~/models/Base';
import Doc from '~/models/Doc';

function docTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;

  beforeEach(async function () {
    console.time('#### docTests');
    context = await init();
    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    console.timeEnd('#### docTests');
  });

  // ── Doc.insert ──────────────────────────────────────────────

  describe('Doc.insert', () => {
    it('should insert a doc with all fields', async () => {
      const doc = await createDoc(ctx, {
        title: 'My Page',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        meta: { icon: '📄' },
      });

      expect(doc).to.be.an.instanceOf(Doc);
      expect(doc.id).to.be.a('string');
      expect(doc.title).to.equal('My Page');
      expect(doc.base_id).to.equal(base.id);
      expect(doc.fk_workspace_id).to.equal(base.fk_workspace_id);
      expect(doc.version).to.equal(1);
      expect(doc.order).to.be.a('number');
    });

    it('should parse JSON content and meta on insert', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
        ],
      };
      const meta = { icon: '🚀', tags: ['important', 'draft'] };

      const doc = await createDoc(ctx, { title: 'Rich Doc', content, meta });

      expect(doc.content).to.be.an('object');
      expect(doc.content.type).to.equal('doc');
      expect(doc.content.content).to.have.lengthOf(2);
      expect(doc.meta).to.be.an('object');
      expect(doc.meta.icon).to.equal('🚀');
      expect(doc.meta.tags).to.deep.equal(['important', 'draft']);
    });

    it('should auto-increment order for multiple docs', async () => {
      const doc1 = await createDoc(ctx, { title: 'First' });
      const doc2 = await createDoc(ctx, { title: 'Second' });
      const doc3 = await createDoc(ctx, { title: 'Third' });

      expect(doc1.order).to.be.lessThan(doc2.order);
      expect(doc2.order).to.be.lessThan(doc3.order);
    });
  });

  // ── Doc.get ─────────────────────────────────────────────────

  describe('Doc.get', () => {
    it('should fetch a doc by ID', async () => {
      const inserted = await createDoc(ctx, { title: 'Fetchable' });
      const fetched = await Doc.get(ctx, inserted.id);

      expect(fetched).to.be.an.instanceOf(Doc);
      expect(fetched.id).to.equal(inserted.id);
      expect(fetched.title).to.equal('Fetchable');
    });

    it('should return parsed content and meta', async () => {
      const inserted = await createDoc(ctx, {
        title: 'JSON Test',
        content: { type: 'doc', content: [] },
        meta: { icon: '📝' },
      });

      const fetched = await Doc.get(ctx, inserted.id);

      expect(fetched.content).to.be.an('object');
      expect(fetched.content.type).to.equal('doc');
      expect(fetched.meta).to.be.an('object');
      expect(fetched.meta.icon).to.equal('📝');
    });

    it('should return undefined for non-existent ID', async () => {
      const fetched = await Doc.get(ctx, 'nonexistent_id_12345');
      expect(fetched).to.be.undefined;
    });
  });

  // ── Doc.list ────────────────────────────────────────────────

  describe('Doc.list', () => {
    it('should return all docs for a base', async () => {
      await createDoc(ctx, { title: 'Page 1' });
      await createDoc(ctx, { title: 'Page 2' });
      await createDoc(ctx, { title: 'Page 3' });

      const list = await Doc.list(ctx, base.id);

      expect(list).to.be.an('array').with.lengthOf(3);
      expect(list.every((d) => d instanceof Doc)).to.be.true;
    });

    it('should return docs ordered by order field', async () => {
      await createDoc(ctx, { title: 'A' });
      await createDoc(ctx, { title: 'B' });
      await createDoc(ctx, { title: 'C' });

      const list = await Doc.list(ctx, base.id);

      for (let i = 1; i < list.length; i++) {
        expect(list[i].order).to.be.greaterThanOrEqual(list[i - 1].order);
      }
    });

    it('should return empty array for base with no docs', async () => {
      const list = await Doc.list(ctx, base.id);
      expect(list).to.be.an('array').with.lengthOf(0);
    });

    it('should include full content in list results', async () => {
      const content = { type: 'doc', content: [{ type: 'paragraph' }] };
      await createDoc(ctx, { title: 'WithContent', content });

      const list = await Doc.list(ctx, base.id);

      expect(list[0].content).to.be.an('object');
      expect(list[0].content.type).to.equal('doc');
    });
  });

  // ── Doc.listLite ────────────────────────────────────────────

  describe('Doc.listLite', () => {
    it('should return docs without content field', async () => {
      await createDoc(ctx, {
        title: 'Lite Test',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      const list = await Doc.listLite(ctx, base.id);

      expect(list).to.have.lengthOf(1);
      expect(list[0]).to.be.an.instanceOf(Doc);
      expect(list[0].title).to.equal('Lite Test');
      expect(list[0].content).to.be.undefined;
    });

    it('should include metadata fields', async () => {
      await createDoc(ctx, {
        title: 'Meta Test',
        meta: { icon: '📄' },
      });

      const list = await Doc.listLite(ctx, base.id);

      expect(list[0]).to.have.property('id');
      expect(list[0]).to.have.property('title');
      expect(list[0]).to.have.property('meta');
      expect(list[0]).to.have.property('order');
      expect(list[0]).to.have.property('version');
      expect(list[0].meta).to.be.an('object');
      expect(list[0].meta.icon).to.equal('📄');
    });

    it('should return same count as list', async () => {
      await createDoc(ctx, { title: 'Page A' });
      await createDoc(ctx, { title: 'Page B' });

      const fullList = await Doc.list(ctx, base.id);
      const liteList = await Doc.listLite(ctx, base.id);

      expect(liteList).to.have.lengthOf(fullList.length);
    });
  });

  // ── Doc.update ──────────────────────────────────────────────

  describe('Doc.update', () => {
    it('should update title', async () => {
      const doc = await createDoc(ctx, { title: 'Old Title' });

      const updated = await Doc.update(ctx, doc.id, { title: 'New Title' });

      expect(updated.title).to.equal('New Title');
      expect(updated.id).to.equal(doc.id);
    });

    it('should update content', async () => {
      const doc = await createDoc(ctx);
      const newContent = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Updated' }] },
        ],
      };

      const updated = await Doc.update(ctx, doc.id, { content: newContent });

      expect(updated.content).to.deep.equal(newContent);
    });

    it('should update meta', async () => {
      const doc = await createDoc(ctx, { meta: { icon: '📄' } });

      const updated = await Doc.update(ctx, doc.id, {
        meta: { icon: '🚀', locked: true },
      });

      expect(updated.meta.icon).to.equal('🚀');
      expect(updated.meta.locked).to.equal(true);
    });

    it('should update version', async () => {
      const doc = await createDoc(ctx);

      const updated = await Doc.update(ctx, doc.id, {
        title: 'Versioned',
        version: 2,
      });

      expect(updated.version).to.equal(2);
    });

    it('should update order for reordering', async () => {
      const doc = await createDoc(ctx);
      const newOrder = 99.5;

      const updated = await Doc.update(ctx, doc.id, { order: newOrder });

      expect(updated.order).to.equal(newOrder);
    });

    it('should persist updates across get calls', async () => {
      const doc = await createDoc(ctx, { title: 'Before' });

      await Doc.update(ctx, doc.id, { title: 'After' });
      const fetched = await Doc.get(ctx, doc.id);

      expect(fetched.title).to.equal('After');
    });
  });

  // ── Doc.delete ──────────────────────────────────────────────

  describe('Doc.delete', () => {
    it('should delete a doc', async () => {
      const doc = await createDoc(ctx, { title: 'Delete Me' });

      const result = await Doc.delete(ctx, doc.id);
      expect(result).to.equal(true);

      const fetched = await Doc.get(ctx, doc.id);
      expect(fetched).to.be.undefined;
    });

    it('should remove doc from list', async () => {
      const doc1 = await createDoc(ctx, { title: 'Keep' });
      const doc2 = await createDoc(ctx, { title: 'Remove' });

      await Doc.delete(ctx, doc2.id);

      const list = await Doc.list(ctx, base.id);
      expect(list).to.have.lengthOf(1);
      expect(list[0].id).to.equal(doc1.id);
    });
  });
}

export default function () {
  describe('Doc', docTests);
}
