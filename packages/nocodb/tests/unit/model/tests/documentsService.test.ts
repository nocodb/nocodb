import 'mocha';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createDocument } from '../../factory/document';
import type { INestApplication } from '@nestjs/common';
import type Base from '~/models/Base';
import { DocumentsService } from '~/services/documents.service';
import Document from '~/models/Document';

function documentsServiceTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;
  let nestApp: INestApplication;
  let documentsService: DocumentsService;

  const mockReq = (user?: any) =>
    ({
      user: user ?? { id: 'test-user', email: 'test@example.com' },
      clientIp: '::1',
    }) as any;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    nestApp = context.nestApp;
    documentsService = nestApp.get(DocumentsService);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
  });

  // ── DocumentsService.list ────────────────────────────────────────

  describe('list', () => {
    it('should return documents without content (lite)', async () => {
      await createDocument(ctx, { title: 'Service List Test' });

      const list = await documentsService.list(ctx, base.id, null);

      expect(list).to.be.an('array').with.lengthOf(1);
      expect(list[0].title).to.equal('Service List Test');
      // listLite excludes content
      expect(list[0].content).to.be.undefined;
    });

    it('should return only root documents when parentId is null', async () => {
      const parent = await createDocument(ctx, { title: 'Root Doc' });
      await createDocument(ctx, { title: 'Child Doc', parent_id: parent.id });

      const rootList = await documentsService.list(ctx, base.id, null);
      expect(rootList).to.have.lengthOf(1);
      expect(rootList[0].title).to.equal('Root Doc');
    });

    it('should return only children when parentId is specified', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      await createDocument(ctx, { title: 'Child A', parent_id: parent.id });
      await createDocument(ctx, { title: 'Child B', parent_id: parent.id });
      await createDocument(ctx, { title: 'Root Sibling' });

      const children = await documentsService.list(ctx, base.id, parent.id);
      expect(children).to.have.lengthOf(2);
      expect(children.map((d) => d.title).sort()).to.deep.equal(['Child A', 'Child B']);
    });

    it('should include comment_count in results', async () => {
      await createDocument(ctx, { title: 'With Comments' });

      const list = await documentsService.list(ctx, base.id, null);

      // comment_count should be present (0 when no comments)
      expect(list[0]).to.have.property('comment_count');
      expect(list[0].comment_count).to.equal(0);
    });
  });

  // ── DocumentsService.get ─────────────────────────────────────────

  describe('get', () => {
    it('should return full document with content', async () => {
      const doc = await createDocument(ctx, { title: 'Get Test' });

      const fetched = await documentsService.get(ctx, doc.id);

      expect(fetched.title).to.equal('Get Test');
      expect(fetched.content).to.be.an('object');
    });

    it('should throw for non-existent document', async () => {
      try {
        await documentsService.get(ctx, 'nonexistent_id');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });

    it('should include comment_count', async () => {
      const doc = await createDocument(ctx, { title: 'Comment Count Test' });

      const fetched = await documentsService.get(ctx, doc.id);

      expect(fetched).to.have.property('comment_count');
      expect(fetched.comment_count).to.equal(0);
    });
  });

  // ── DocumentsService.create ──────────────────────────────────────

  describe('create', () => {
    it('should create a document with title and content', async () => {
      const doc = await documentsService.create(
        ctx,
        {
          title: 'Created via Service',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        },
        mockReq(context.user),
      );

      expect(doc).to.be.an.instanceOf(Document);
      expect(doc.title).to.equal('Created via Service');
      expect(doc.version).to.equal(1);
      expect(doc.base_id).to.equal(base.id);
    });

    it('should default to empty ProseMirror doc when no content', async () => {
      const doc = await documentsService.create(
        ctx,
        { title: 'No Content' },
        mockReq(context.user),
      );

      expect(doc.content).to.deep.equal({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
    });

    it('should trim whitespace-only title to Untitled', async () => {
      const doc = await documentsService.create(
        ctx,
        { title: '   ' },
        mockReq(context.user),
      );

      expect(doc.title).to.equal('Untitled');
    });

    it('should trim empty title to Untitled', async () => {
      const doc = await documentsService.create(
        ctx,
        { title: '' },
        mockReq(context.user),
      );

      expect(doc.title).to.equal('Untitled');
    });

    it('should reject oversized content', async () => {
      // Create content > 5MB
      const largeContent = {
        type: 'doc',
        content: [{ type: 'text', text: 'x'.repeat(6 * 1024 * 1024) }],
      };

      try {
        await documentsService.create(ctx, { title: 'Big', content: largeContent }, mockReq(context.user));
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('maximum size');
      }
    });

    it('should create a sub-document with parent_id', async () => {
      const parent = await documentsService.create(
        ctx,
        { title: 'Parent' },
        mockReq(context.user),
      );

      const child = await documentsService.create(
        ctx,
        { title: 'Child', parent_id: parent.id },
        mockReq(context.user),
      );

      expect(child.parent_id).to.equal(parent.id);

      // Parent should now have has_children
      const parentDoc = await Document.get(ctx, parent.id);
      expect(parentDoc.has_children).to.be.ok;
    });

    it('should set created_by and updated_by from request user', async () => {
      const doc = await documentsService.create(
        ctx,
        { title: 'Authored' },
        mockReq({ id: 'user-42', email: 'user42@test.com' }),
      );

      expect(doc.created_by).to.equal('user-42');
      expect(doc.updated_by).to.equal('user-42');
    });
  });

  // ── DocumentsService.update ──────────────────────────────────────

  describe('update', () => {
    it('should update title and bump version', async () => {
      const doc = await createDocument(ctx, { title: 'V1' });

      const updated = await documentsService.update(
        ctx,
        doc.id,
        { title: 'V2', version: doc.version },
        mockReq(context.user),
      );

      expect(updated.title).to.equal('V2');
      expect(updated.version).to.equal(doc.version + 1);
    });

    it('should reject stale version (optimistic concurrency)', async () => {
      const doc = await createDocument(ctx, { title: 'Concurrent' });

      // First update succeeds
      await documentsService.update(
        ctx,
        doc.id,
        { title: 'Update 1', version: doc.version },
        mockReq(context.user),
      );

      // Second update with the original (now stale) version should fail
      try {
        await documentsService.update(
          ctx,
          doc.id,
          { title: 'Update 2', version: doc.version },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('modified by another user');
      }
    });

    it('should reject update without version', async () => {
      const doc = await createDocument(ctx);

      try {
        await documentsService.update(
          ctx,
          doc.id,
          { title: 'No Version' } as any,
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('version is required');
      }
    });

    it('should reject oversized content on update', async () => {
      const doc = await createDocument(ctx);
      const largeContent = {
        type: 'doc',
        content: [{ type: 'text', text: 'x'.repeat(6 * 1024 * 1024) }],
      };

      try {
        await documentsService.update(
          ctx,
          doc.id,
          { content: largeContent, version: doc.version },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('maximum size');
      }
    });

    it('should throw for non-existent document', async () => {
      try {
        await documentsService.update(
          ctx,
          'nonexistent_id',
          { title: 'Ghost', version: 1 },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });

    it('should trim empty title to Untitled on update', async () => {
      const doc = await createDocument(ctx, { title: 'Has Title' });

      const updated = await documentsService.update(
        ctx,
        doc.id,
        { title: '   ', version: doc.version },
        mockReq(context.user),
      );

      expect(updated.title).to.equal('Untitled');
    });

    it('should update content without changing title', async () => {
      const doc = await createDocument(ctx, { title: 'Keep Title' });
      const newContent = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }],
      };

      const updated = await documentsService.update(
        ctx,
        doc.id,
        { content: newContent, version: doc.version },
        mockReq(context.user),
      );

      expect(updated.title).to.equal('Keep Title');
      expect(updated.content).to.deep.equal(newContent);
    });
  });

  // ── DocumentsService.delete ──────────────────────────────────────

  describe('delete', () => {
    it('should delete a document', async () => {
      const doc = await createDocument(ctx, { title: 'To Delete' });

      const result = await documentsService.delete(ctx, doc.id, mockReq(context.user));
      expect(result).to.equal(true);

      const fetched = await Document.get(ctx, doc.id);
      expect(fetched).to.be.undefined;
    });

    it('should throw for non-existent document', async () => {
      try {
        await documentsService.delete(ctx, 'nonexistent_id', mockReq(context.user));
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });

    it('should cascade soft-delete to descendants', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: parent.id });
      const grandchild = await createDocument(ctx, { title: 'Grandchild', parent_id: child.id });

      await documentsService.delete(ctx, parent.id, mockReq(context.user));

      expect(await Document.get(ctx, parent.id)).to.be.undefined;
      expect(await Document.get(ctx, child.id)).to.be.undefined;
      expect(await Document.get(ctx, grandchild.id)).to.be.undefined;
    });

    it('should not affect sibling documents when deleting one child', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child1 = await createDocument(ctx, { title: 'Child 1', parent_id: parent.id });
      const child2 = await createDocument(ctx, { title: 'Child 2', parent_id: parent.id });

      await documentsService.delete(ctx, child1.id, mockReq(context.user));

      expect(await Document.get(ctx, child1.id)).to.be.undefined;
      expect(await Document.get(ctx, child2.id)).to.not.be.undefined;
      expect(await Document.get(ctx, parent.id)).to.not.be.undefined;
    });
  });

  // ── DocumentsService.reorder ─────────────────────────────────────

  describe('reorder', () => {
    it('should update order without bumping version', async () => {
      const doc = await createDocument(ctx);

      await documentsService.reorder(ctx, doc.id, { order: 50.5 }, mockReq(context.user));

      const fetched = await Document.get(ctx, doc.id);
      expect(fetched.order).to.equal(50.5);
      // Reorder does not bump version
      expect(fetched.version).to.equal(doc.version);
    });

    it('should throw for non-existent document', async () => {
      try {
        await documentsService.reorder(ctx, 'nonexistent_id', { order: 1 }, mockReq(context.user));
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });

    it('should move document to a new parent', async () => {
      const doc = await createDocument(ctx, { title: 'Mover' });
      const target = await createDocument(ctx, { title: 'Target' });

      const moved = await documentsService.reorder(
        ctx,
        doc.id,
        { order: 1, parent_id: target.id },
        mockReq(context.user),
      );

      expect(moved.parent_id).to.equal(target.id);

      const targetDoc = await Document.get(ctx, target.id);
      expect(targetDoc.has_children).to.be.ok;
    });

    it('should move document to root (parent_id = null)', async () => {
      const parent = await createDocument(ctx, { title: 'Parent' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: parent.id });

      await documentsService.reorder(
        ctx,
        child.id,
        { order: 99, parent_id: null },
        mockReq(context.user),
      );

      const fetched = await Document.get(ctx, child.id);
      expect(fetched.parent_id).to.be.null;

      const parentDoc = await Document.get(ctx, parent.id);
      expect(parentDoc.has_children).to.not.be.ok;
    });

    it('should reject moving document under itself', async () => {
      const doc = await createDocument(ctx, { title: 'Self Ref' });

      try {
        await documentsService.reorder(
          ctx,
          doc.id,
          { order: 1, parent_id: doc.id },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('Cannot move document under itself');
      }
    });

    it('should reject moving document under its own descendant (circular)', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, { title: 'Child', parent_id: root.id });
      const grandchild = await createDocument(ctx, { title: 'Grandchild', parent_id: child.id });

      try {
        await documentsService.reorder(
          ctx,
          root.id,
          { order: 1, parent_id: grandchild.id },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('Cannot move document under its own descendant');
      }
    });

    it('should reject moving to a non-existent parent', async () => {
      const doc = await createDocument(ctx, { title: 'Orphan Mover' });

      try {
        await documentsService.reorder(
          ctx,
          doc.id,
          { order: 1, parent_id: 'nonexistent_parent_id' },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });

    it('should reject cross-base move', async () => {
      // Create a second base
      const base2 = await createProject(context);
      const ctx2 = { workspace_id: base2.fk_workspace_id, base_id: base2.id };

      const doc = await createDocument(ctx, { title: 'Doc in Base 1' });
      const targetInOtherBase = await createDocument(ctx2, { title: 'Doc in Base 2' });

      try {
        await documentsService.reorder(
          ctx,
          doc.id,
          { order: 1, parent_id: targetInOtherBase.id },
          mockReq(context.user),
        );
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });
  });
}

export default function () {
  describe('DocumentsService', documentsServiceTests);
}
