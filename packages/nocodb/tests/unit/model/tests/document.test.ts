import 'mocha';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createDocument } from '../../factory/document';
import type Base from '~/models/Base';
import Document from '~/models/Document';

function documentTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
  });

  // ── Document.insert ──────────────────────────────────────────────

  describe('Document.insert', () => {
    it('should insert a document with all fields', async () => {
      const doc = await createDocument(ctx, {
        title: 'My Document',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        meta: { icon: '📄' },
      });

      expect(doc).to.be.an.instanceOf(Document);
      expect(doc.id).to.be.a('string');
      expect(doc.title).to.equal('My Document');
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

      const doc = await createDocument(ctx, { title: 'Rich Document', content, meta });

      expect(doc.content).to.be.an('object');
      expect(doc.content.type).to.equal('doc');
      expect(doc.content.content).to.have.lengthOf(2);
      expect(doc.meta).to.be.an('object');
      expect(doc.meta.icon).to.equal('🚀');
      expect(doc.meta.tags).to.deep.equal(['important', 'draft']);
    });

    it('should auto-increment order for multiple documents', async () => {
      const doc1 = await createDocument(ctx, { title: 'First' });
      const doc2 = await createDocument(ctx, { title: 'Second' });
      const doc3 = await createDocument(ctx, { title: 'Third' });

      expect(doc1.order).to.be.lessThan(doc2.order);
      expect(doc2.order).to.be.lessThan(doc3.order);
    });

    it('should insert a sub-document with parent_id', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: parent.id });

      expect(child.parent_id).to.equal(parent.id);
      expect(child.base_id).to.equal(parent.base_id);
    });

    it('should set has_children on parent when inserting a child', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });

      // Before adding children, parent should not have has_children
      const parentBefore = await Document.get(ctx, parent.id);
      expect(parentBefore.has_children).to.not.be.ok;

      await createDocument(ctx, { title: 'Child', parent_id: parent.id });

      const parentAfter = await Document.get(ctx, parent.id);
      expect(parentAfter.has_children).to.be.ok;
    });

    it('should auto-increment order independently per parent', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });

      const rootDoc = await createDocument(ctx, { title: 'Root Doc' });
      const child1 = await createDocument(ctx, { title: 'Child 1', parent_id: parent.id });
      const child2 = await createDocument(ctx, { title: 'Child 2', parent_id: parent.id });

      // Children should be ordered independently of root docs
      expect(child1.order).to.be.lessThan(child2.order);
    });
  });

  // ── Document.get ─────────────────────────────────────────────────

  describe('Document.get', () => {
    it('should fetch a document by ID', async () => {
      const inserted = await createDocument(ctx, { title: 'Fetchable' });
      const fetched = await Document.get(ctx, inserted.id);

      expect(fetched).to.be.an.instanceOf(Document);
      expect(fetched.id).to.equal(inserted.id);
      expect(fetched.title).to.equal('Fetchable');
    });

    it('should return parsed content and meta', async () => {
      const inserted = await createDocument(ctx, {
        title: 'JSON Test',
        content: { type: 'doc', content: [] },
        meta: { icon: '📝' },
      });

      const fetched = await Document.get(ctx, inserted.id);

      expect(fetched.content).to.be.an('object');
      expect(fetched.content.type).to.equal('doc');
      expect(fetched.meta).to.be.an('object');
      expect(fetched.meta.icon).to.equal('📝');
    });

    it('should return undefined for non-existent ID', async () => {
      const fetched = await Document.get(ctx, 'nonexistent_id_12345');
      expect(fetched).to.be.undefined;
    });

    it('should not return soft-deleted documents', async () => {
      const doc = await createDocument(ctx, { title: 'To Soft Delete' });
      await Document.softDelete(ctx, doc.id);

      const fetched = await Document.get(ctx, doc.id);
      expect(fetched).to.be.undefined;
    });
  });

  // ── Document.list ────────────────────────────────────────────────

  describe('Document.list', () => {
    it('should return all documents for a base', async () => {
      await createDocument(ctx, { title: 'Document 1' });
      await createDocument(ctx, { title: 'Document 2' });
      await createDocument(ctx, { title: 'Document 3' });

      const list = await Document.list(ctx, base.id);

      expect(list).to.be.an('array').with.lengthOf(3);
      expect(list.every((d) => d instanceof Document)).to.be.true;
    });

    it('should return documents ordered by order field', async () => {
      await createDocument(ctx, { title: 'A' });
      await createDocument(ctx, { title: 'B' });
      await createDocument(ctx, { title: 'C' });

      const list = await Document.list(ctx, base.id);

      for (let i = 1; i < list.length; i++) {
        expect(list[i].order).to.be.greaterThanOrEqual(list[i - 1].order);
      }
    });

    it('should return empty array for base with no documents', async () => {
      const list = await Document.list(ctx, base.id);
      expect(list).to.be.an('array').with.lengthOf(0);
    });

    it('should include full content in list results', async () => {
      const content = { type: 'doc', content: [{ type: 'paragraph' }] };
      await createDocument(ctx, { title: 'WithContent', content });

      const list = await Document.list(ctx, base.id);

      expect(list[0].content).to.be.an('object');
      expect(list[0].content.type).to.equal('doc');
    });

    it('should filter by parentId — root only when null', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      await createDocument(ctx, { title: 'Child', parent_id: parent.id });

      const rootDocs = await Document.list(ctx, base.id, null);
      expect(rootDocs).to.have.lengthOf(1);
      expect(rootDocs[0].title).to.equal('Parent');
    });

    it('should filter by parentId — children only', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      await createDocument(ctx, { title: 'Child A', parent_id: parent.id });
      await createDocument(ctx, { title: 'Child B', parent_id: parent.id });

      const children = await Document.list(ctx, base.id, parent.id);
      expect(children).to.have.lengthOf(2);
      expect(children.map((d) => d.title).sort()).to.deep.equal(['Child A', 'Child B']);
    });

    it('should not include soft-deleted documents', async () => {
      const doc1 = await createDocument(ctx, { title: 'Alive' });
      const doc2 = await createDocument(ctx, { title: 'Deleted' });

      await Document.softDelete(ctx, doc2.id);

      const list = await Document.list(ctx, base.id);
      expect(list).to.have.lengthOf(1);
      expect(list[0].title).to.equal('Alive');
    });
  });

  // ── Document.listLite ────────────────────────────────────────────

  describe('Document.listLite', () => {
    it('should return documents without content field', async () => {
      await createDocument(ctx, {
        title: 'Lite Test',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      });

      const list = await Document.listLite(ctx, base.id);

      expect(list).to.have.lengthOf(1);
      expect(list[0]).to.be.an.instanceOf(Document);
      expect(list[0].title).to.equal('Lite Test');
      expect(list[0].content).to.be.undefined;
    });

    it('should include metadata fields', async () => {
      await createDocument(ctx, {
        title: 'Meta Test',
        meta: { icon: '📄' },
      });

      const list = await Document.listLite(ctx, base.id);

      expect(list[0]).to.have.property('id');
      expect(list[0]).to.have.property('title');
      expect(list[0]).to.have.property('meta');
      expect(list[0]).to.have.property('order');
      expect(list[0]).to.have.property('version');
      expect(list[0].meta).to.be.an('object');
      expect(list[0].meta.icon).to.equal('📄');
    });

    it('should return same count as list', async () => {
      await createDocument(ctx, { title: 'Document A' });
      await createDocument(ctx, { title: 'Document B' });

      const fullList = await Document.list(ctx, base.id);
      const liteList = await Document.listLite(ctx, base.id);

      expect(liteList).to.have.lengthOf(fullList.length);
    });

    it('should filter by parentId', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      await createDocument(ctx, { title: 'Child 1', parent_id: parent.id });
      await createDocument(ctx, { title: 'Child 2', parent_id: parent.id });

      const rootList = await Document.listLite(ctx, base.id, null);
      expect(rootList).to.have.lengthOf(1);

      const childList = await Document.listLite(ctx, base.id, parent.id);
      expect(childList).to.have.lengthOf(2);
    });

    it('should include has_children field', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      await createDocument(ctx, { title: 'Child', parent_id: parent.id });

      const list = await Document.listLite(ctx, base.id, null);
      expect(list[0].has_children).to.be.ok;
    });
  });

  // ── Document.update ──────────────────────────────────────────────

  describe('Document.update', () => {
    it('should update title', async () => {
      const doc = await createDocument(ctx, { title: 'Old Title' });

      const updated = await Document.update(ctx, doc.id, { title: 'New Title' });

      expect(updated.title).to.equal('New Title');
      expect(updated.id).to.equal(doc.id);
    });

    it('should update content', async () => {
      const doc = await createDocument(ctx);
      const newContent = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Updated' }] },
        ],
      };

      const updated = await Document.update(ctx, doc.id, { content: newContent });

      expect(updated.content).to.deep.equal(newContent);
    });

    it('should update meta', async () => {
      const doc = await createDocument(ctx, { meta: { icon: '📄' } });

      const updated = await Document.update(ctx, doc.id, {
        meta: { icon: '🚀', locked: true },
      });

      expect(updated.meta.icon).to.equal('🚀');
      expect(updated.meta.locked).to.equal(true);
    });

    it('should update version', async () => {
      const doc = await createDocument(ctx);

      const updated = await Document.update(ctx, doc.id, {
        title: 'Versioned',
        version: 2,
      });

      expect(updated.version).to.equal(2);
    });

    it('should update order for reordering', async () => {
      const doc = await createDocument(ctx);
      const newOrder = 99.5;

      const updated = await Document.update(ctx, doc.id, { order: newOrder });

      expect(updated.order).to.equal(newOrder);
    });

    it('should persist updates across get calls', async () => {
      const doc = await createDocument(ctx, { title: 'Before' });

      await Document.update(ctx, doc.id, { title: 'After' });
      const fetched = await Document.get(ctx, doc.id);

      expect(fetched.title).to.equal('After');
    });
  });

  // ── Document.delete ──────────────────────────────────────────────

  describe('Document.delete', () => {
    it('should delete a document', async () => {
      const doc = await createDocument(ctx, { title: 'Delete Me' });

      const result = await Document.delete(ctx, doc.id);
      expect(result).to.equal(true);

      const fetched = await Document.get(ctx, doc.id);
      expect(fetched).to.be.undefined;
    });

    it('should remove document from list', async () => {
      const doc1 = await createDocument(ctx, { title: 'Keep' });
      const doc2 = await createDocument(ctx, { title: 'Remove' });

      await Document.delete(ctx, doc2.id);

      const list = await Document.list(ctx, base.id);
      expect(list).to.have.lengthOf(1);
      expect(list[0].id).to.equal(doc1.id);
    });
  });

  // ── Document.softDelete ─────────────────────────────────────────

  describe('Document.softDelete', () => {
    it('should soft-delete a document (not visible in list)', async () => {
      const doc = await createDocument(ctx, { title: 'Soft Delete Me' });

      await Document.softDelete(ctx, doc.id);

      const list = await Document.list(ctx, base.id);
      expect(list).to.have.lengthOf(0);
    });

    it('should cascade soft-delete to all descendants', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: root.id });
      const grandchild = await createDocument(ctx, { title: 'Grandchild', parent_id: child.id });

      await Document.softDelete(ctx, root.id);

      // All three should be gone
      expect(await Document.get(ctx, root.id)).to.be.undefined;
      expect(await Document.get(ctx, child.id)).to.be.undefined;
      expect(await Document.get(ctx, grandchild.id)).to.be.undefined;
    });

    it('should update parent has_children after soft-deleting only child', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child = await createDocument(ctx, { title: 'Only Child', parent_id: parent.id });

      // Parent should have has_children before delete
      let parentDoc = await Document.get(ctx, parent.id);
      expect(parentDoc.has_children).to.be.ok;

      await Document.softDelete(ctx, child.id);

      // Parent should no longer have has_children
      parentDoc = await Document.get(ctx, parent.id);
      expect(parentDoc.has_children).to.not.be.ok;
    });

    it('should keep parent has_children if siblings remain', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child1 = await createDocument(ctx, { title: 'Child 1', parent_id: parent.id });
      const child2 = await createDocument(ctx, { title: 'Child 2', parent_id: parent.id });

      await Document.softDelete(ctx, child1.id);

      const parentDoc = await Document.get(ctx, parent.id);
      expect(parentDoc.has_children).to.be.ok;
    });
  });

  // ── Document.getDescendantIds ───────────────────────────────────

  describe('Document.getDescendantIds', () => {
    it('should return empty array for leaf document', async () => {
      const leaf = await createDocument(ctx, { title: 'Leaf' });

      const ids = await Document.getDescendantIds(ctx, leaf.id);
      expect(ids).to.be.an('array').with.lengthOf(0);
    });

    it('should return direct children IDs', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child1 = await createDocument(ctx, { title: 'Child 1', parent_id: parent.id });
      const child2 = await createDocument(ctx, { title: 'Child 2', parent_id: parent.id });

      const ids = await Document.getDescendantIds(ctx, parent.id);
      expect(ids).to.have.lengthOf(2);
      expect(ids).to.include(child1.id);
      expect(ids).to.include(child2.id);
    });

    it('should return deep descendants recursively', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: root.id });
      const grandchild = await createDocument(ctx, { title: 'Grandchild', parent_id: child.id });
      const greatGrandchild = await createDocument(ctx, { title: 'Great-Grandchild', parent_id: grandchild.id });

      const ids = await Document.getDescendantIds(ctx, root.id);
      expect(ids).to.have.lengthOf(3);
      expect(ids).to.include(child.id);
      expect(ids).to.include(grandchild.id);
      expect(ids).to.include(greatGrandchild.id);
    });
  });

  // ── Document.move ───────────────────────────────────────────────

  describe('Document.move', () => {
    it('should move a root document under a parent', async () => {
      const doc = await createDocument(ctx, { title: 'Mover' });
      const target = await createDocument(ctx, { title: 'Target Parent' });

      const moved = await Document.move(ctx, doc.id, target.id, 1, 'test-user');

      expect(moved.parent_id).to.equal(target.id);

      const targetDoc = await Document.get(ctx, target.id);
      expect(targetDoc.has_children).to.be.ok;
    });

    it('should move a child document to root', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: parent.id });

      const moved = await Document.move(ctx, child.id, null, 99, 'test-user');

      expect(moved.parent_id).to.be.null;

      // Old parent should no longer have children
      const parentDoc = await Document.get(ctx, parent.id);
      expect(parentDoc.has_children).to.not.be.ok;
    });

    it('should update order on move', async () => {
      const doc = await createDocument(ctx, { title: 'Doc' });
      const target = await createDocument(ctx, { title: 'Target' });

      const moved = await Document.move(ctx, doc.id, target.id, 42.5, 'test-user');

      expect(moved.order).to.equal(42.5);
    });

    it('should move between parents and update both has_children', async () => {
      const parentA = await createDocument(ctx, { title: 'Parent A' });
      const parentB = await createDocument(ctx, { title: 'Parent B' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: parentA.id });

      await Document.move(ctx, child.id, parentB.id, 1, 'test-user');

      const parentADoc = await Document.get(ctx, parentA.id);
      const parentBDoc = await Document.get(ctx, parentB.id);

      expect(parentADoc.has_children).to.not.be.ok;
      expect(parentBDoc.has_children).to.be.ok;
    });
  });
}

export default function () {
  describe('Document', documentTests);
}
