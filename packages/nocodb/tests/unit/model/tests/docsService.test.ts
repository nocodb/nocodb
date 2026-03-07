import 'mocha';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createDoc } from '../../factory/doc';
import type { INestApplication } from '@nestjs/common';
import type Base from '~/models/Base';
import { DocsService } from '~/services/docs.service';
import Doc from '~/models/Doc';

function docsServiceTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let base: Base;
  let nestApp: INestApplication;
  let docsService: DocsService;

  const mockReq = (user?: any) =>
    ({
      user: user ?? { id: 'test-user', email: 'test@example.com' },
      clientIp: '::1',
    }) as any;

  beforeEach(async function () {
    console.time('#### docsServiceTests');
    context = await init();
    base = await createProject(context);
    nestApp = context.nestApp;
    docsService = nestApp.get(DocsService);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };
    console.timeEnd('#### docsServiceTests');
  });

  // ── DocsService.list ────────────────────────────────────────

  describe('list', () => {
    it('should return docs without content (lite)', async () => {
      await createDoc(ctx, { title: 'Service List Test' });

      const list = await docsService.list(ctx, base.id);

      expect(list).to.be.an('array').with.lengthOf(1);
      expect(list[0].title).to.equal('Service List Test');
      // listLite excludes content
      expect(list[0].content).to.be.undefined;
    });
  });

  // ── DocsService.get ─────────────────────────────────────────

  describe('get', () => {
    it('should return full doc with content', async () => {
      const doc = await createDoc(ctx, { title: 'Get Test' });

      const fetched = await docsService.get(ctx, doc.id);

      expect(fetched.title).to.equal('Get Test');
      expect(fetched.content).to.be.an('object');
    });

    it('should throw for non-existent doc', async () => {
      try {
        await docsService.get(ctx, 'nonexistent_id');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });
  });

  // ── DocsService.create ──────────────────────────────────────

  describe('create', () => {
    it('should create a doc with title and content', async () => {
      const doc = await docsService.create(
        ctx,
        {
          title: 'Created via Service',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        },
        mockReq(context.user),
      );

      expect(doc).to.be.an.instanceOf(Doc);
      expect(doc.title).to.equal('Created via Service');
      expect(doc.version).to.equal(1);
      expect(doc.base_id).to.equal(base.id);
    });

    it('should default to empty ProseMirror doc when no content', async () => {
      const doc = await docsService.create(
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
      const doc = await docsService.create(
        ctx,
        { title: '   ' },
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
        await docsService.create(ctx, { title: 'Big', content: largeContent }, mockReq(context.user));
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('maximum size');
      }
    });
  });

  // ── DocsService.update ──────────────────────────────────────

  describe('update', () => {
    it('should update title and bump version', async () => {
      const doc = await createDoc(ctx, { title: 'V1' });

      const updated = await docsService.update(
        ctx,
        doc.id,
        { title: 'V2', version: doc.version },
        mockReq(context.user),
      );

      expect(updated.title).to.equal('V2');
      expect(updated.version).to.equal(doc.version + 1);
    });

    it('should reject stale version (optimistic concurrency)', async () => {
      const doc = await createDoc(ctx, { title: 'Concurrent' });

      // First update succeeds
      await docsService.update(
        ctx,
        doc.id,
        { title: 'Update 1', version: doc.version },
        mockReq(context.user),
      );

      // Second update with the original (now stale) version should fail
      try {
        await docsService.update(
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
      const doc = await createDoc(ctx);

      try {
        await docsService.update(
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
      const doc = await createDoc(ctx);
      const largeContent = {
        type: 'doc',
        content: [{ type: 'text', text: 'x'.repeat(6 * 1024 * 1024) }],
      };

      try {
        await docsService.update(
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

    it('should throw for non-existent doc', async () => {
      try {
        await docsService.update(
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
  });

  // ── DocsService.delete ──────────────────────────────────────

  describe('delete', () => {
    it('should delete a doc', async () => {
      const doc = await createDoc(ctx, { title: 'To Delete' });

      const result = await docsService.delete(ctx, doc.id, mockReq(context.user));
      expect(result).to.equal(true);

      const fetched = await Doc.get(ctx, doc.id);
      expect(fetched).to.be.undefined;
    });

    it('should throw for non-existent doc', async () => {
      try {
        await docsService.delete(ctx, 'nonexistent_id', mockReq(context.user));
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });
  });

  // ── DocsService.reorder ─────────────────────────────────────

  describe('reorder', () => {
    it('should update order without bumping version', async () => {
      const doc = await createDoc(ctx);

      await docsService.reorder(ctx, doc.id, { order: 50.5 });

      const fetched = await Doc.get(ctx, doc.id);
      expect(fetched.order).to.equal(50.5);
      // Reorder does not bump version
      expect(fetched.version).to.equal(doc.version);
    });

    it('should throw for non-existent doc', async () => {
      try {
        await docsService.reorder(ctx, 'nonexistent_id', { order: 1 });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.include('not found');
      }
    });
  });
}

export default function () {
  describe('DocsService', docsServiceTests);
}
