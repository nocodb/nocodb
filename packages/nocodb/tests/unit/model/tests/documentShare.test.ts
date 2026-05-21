import 'mocha';
import { expect } from 'chai';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createDocument } from '../../factory/document';
import type Base from '~/models/Base';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import Document from '~/models/Document';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

// Insert a DOCUMENT_VISIBILITY row directly via ncMeta. We bypass the
// PermissionsService because that path triggers extra side-effects
// (broadcasts, app-hooks) that aren't relevant to the model-layer behavior
// under test.
const seedVisibilityRestriction = async (
  ctx: { workspace_id: string; base_id: string },
  docId: string,
) => {
  await Noco.ncMeta.metaInsert2(
    ctx.workspace_id,
    ctx.base_id,
    MetaTable.PERMISSIONS,
    {
      base_id: ctx.base_id,
      fk_workspace_id: ctx.workspace_id,
      entity: PermissionEntity.DOCUMENT,
      entity_id: docId,
      permission: PermissionKey.DOCUMENT_VISIBILITY,
      granted_type: PermissionGrantedType.ROLE,
      granted_role: PermissionRole.CREATOR,
      created_by: 'test-user',
    },
  );
};

function documentShareTests() {
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

  // ── Document.share ───────────────────────────────────────────────

  describe('Document.share', () => {
    it('should assign a uuid and seed include_subtree=true', async () => {
      const doc = await createDocument(ctx, { title: 'Shareable' });

      const shared = await Document.share(ctx, doc.id);

      expect(shared.uuid).to.be.a('string').with.lengthOf.greaterThan(0);
      expect((shared.meta as any)?.share?.include_subtree).to.equal(true);
    });

    it('should be idempotent — second call returns the same uuid', async () => {
      const doc = await createDocument(ctx, { title: 'Idempotent Share' });

      const first = await Document.share(ctx, doc.id);
      const second = await Document.share(ctx, doc.id);

      expect(second.uuid).to.equal(first.uuid);
    });

    it('should preserve existing meta fields when seeding share meta', async () => {
      const doc = await createDocument(ctx, {
        title: 'Has Meta',
        meta: { icon: '🚀', cover_image_file_ref_id: 'fr_123' },
      });

      const shared = await Document.share(ctx, doc.id);

      expect((shared.meta as any).icon).to.equal('🚀');
      expect((shared.meta as any).cover_image_file_ref_id).to.equal('fr_123');
      expect((shared.meta as any).share.include_subtree).to.equal(true);
    });

    it('should reject share when a DOCUMENT_VISIBILITY row exists', async () => {
      const doc = await createDocument(ctx, { title: 'Restricted' });
      await seedVisibilityRestriction(ctx, doc.id);

      let thrown: any;
      try {
        await Document.share(ctx, doc.id);
      } catch (e) {
        thrown = e;
      }

      expect(thrown, 'expected share() to throw on a restricted doc').to.exist;
      // Doc must still be unshared after the failed call.
      const after = await Document.getMeta(ctx, doc.id);
      expect(after.uuid ?? null).to.equal(null);
    });

    it('should throw genericNotFound for a missing doc', async () => {
      let thrown: any;
      try {
        await Document.share(ctx, 'doc_nonexistent_id_xx');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.exist;
    });
  });

  // ── Document.unshare ─────────────────────────────────────────────

  describe('Document.unshare', () => {
    it('should clear the uuid', async () => {
      const doc = await createDocument(ctx, { title: 'To Unshare' });
      const shared = await Document.share(ctx, doc.id);
      expect(shared.uuid).to.be.a('string');

      await Document.unshare(ctx, doc.id);

      const after = await Document.getMeta(ctx, doc.id);
      expect(after.uuid ?? null).to.equal(null);
    });

    it('should drop meta.share but preserve other meta fields', async () => {
      const doc = await createDocument(ctx, {
        title: 'Mixed Meta',
        meta: { icon: '📄', cover_image_file_ref_id: 'fr_xyz' },
      });
      await Document.share(ctx, doc.id);

      await Document.unshare(ctx, doc.id);

      const after = await Document.getMeta(ctx, doc.id);
      expect((after.meta as any).icon).to.equal('📄');
      expect((after.meta as any).cover_image_file_ref_id).to.equal('fr_xyz');
      expect((after.meta as any).share).to.be.undefined;
    });

    it('should be safe to call on an already-unshared doc', async () => {
      const doc = await createDocument(ctx, { title: 'Never Shared' });

      // Should not throw — unshare is a tolerant cleanup operation.
      await Document.unshare(ctx, doc.id);

      const after = await Document.getMeta(ctx, doc.id);
      expect(after.uuid ?? null).to.equal(null);
    });
  });

  // ── Document.updateShareSettings ────────────────────────────────

  describe('Document.updateShareSettings', () => {
    it('should flip include_subtree to false', async () => {
      const doc = await createDocument(ctx, { title: 'Subtree Toggle' });
      await Document.share(ctx, doc.id);

      const updated = await Document.updateShareSettings(ctx, doc.id, {
        include_subtree: false,
      });

      expect((updated.meta as any).share.include_subtree).to.equal(false);
    });

    it('should preserve uuid and unrelated meta fields', async () => {
      const doc = await createDocument(ctx, {
        title: 'Keep Other Meta',
        meta: { icon: '🔒' },
      });
      const shared = await Document.share(ctx, doc.id);

      const updated = await Document.updateShareSettings(ctx, doc.id, {
        include_subtree: false,
      });

      expect(updated.uuid).to.equal(shared.uuid);
      expect((updated.meta as any).icon).to.equal('🔒');
    });

    it('should reject when the doc is not shared', async () => {
      const doc = await createDocument(ctx, { title: 'Unshared' });

      let thrown: any;
      try {
        await Document.updateShareSettings(ctx, doc.id, {
          include_subtree: false,
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.exist;
    });
  });

  // ── Document.getByUUID ──────────────────────────────────────────

  describe('Document.getByUUID', () => {
    it('should return the Document by uuid', async () => {
      const doc = await createDocument(ctx, { title: 'By UUID' });
      const shared = await Document.share(ctx, doc.id);

      const fetched = await Document.getByUUID(ctx, shared.uuid!);

      expect(fetched).to.be.an.instanceOf(Document);
      expect(fetched!.id).to.equal(doc.id);
      expect(fetched!.base_id).to.equal(base.id);
      expect(fetched!.fk_workspace_id).to.equal(base.fk_workspace_id);
    });

    it('should return null for an unknown uuid', async () => {
      const fetched = await Document.getByUUID(ctx, 'unknown-uuid-12345');
      expect(fetched).to.equal(null);
    });

    it('should return null after the doc is soft-deleted', async () => {
      const doc = await createDocument(ctx, {
        title: 'Soft Delete Then Lookup',
      });
      const shared = await Document.share(ctx, doc.id);

      await Document.softDelete(ctx, doc.id);

      const fetched = await Document.getByUUID(ctx, shared.uuid!);
      expect(fetched).to.equal(null);
    });

    it('should return null after the doc is hard-deleted', async () => {
      const doc = await createDocument(ctx, {
        title: 'Hard Delete Then Lookup',
      });
      const shared = await Document.share(ctx, doc.id);

      await Document.delete(ctx, doc.id);

      const fetched = await Document.getByUUID(ctx, shared.uuid!);
      expect(fetched).to.equal(null);
    });

    it('should cache the row under the global root scope', async () => {
      const doc = await createDocument(ctx, { title: 'Cache Check' });
      const shared = await Document.share(ctx, doc.id);

      // Force a fetch to populate the cache.
      await Document.getByUUID(ctx, shared.uuid!);

      const cacheKey = `${CacheScope.DOCUMENT}:uuid:${shared.uuid}`;
      const cached = await NocoCache.get(
        'root',
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );
      expect(cached).to.exist;
      expect(cached.id).to.equal(doc.id);
    });
  });

  // ── Document.hasVisibilityRestriction ───────────────────────────

  describe('Document.hasVisibilityRestriction', () => {
    it('should return false when no permission row exists', async () => {
      const doc = await createDocument(ctx, { title: 'No Restriction' });

      const restricted = await Document.hasVisibilityRestriction(
        ctx.workspace_id,
        ctx.base_id,
        doc.id,
      );

      expect(restricted).to.equal(false);
    });

    it('should return true when a DOCUMENT_VISIBILITY row exists', async () => {
      const doc = await createDocument(ctx, { title: 'Has Restriction' });
      await seedVisibilityRestriction(ctx, doc.id);

      const restricted = await Document.hasVisibilityRestriction(
        ctx.workspace_id,
        ctx.base_id,
        doc.id,
      );

      expect(restricted).to.equal(true);
    });
  });

  // ── Document.getShareScope ──────────────────────────────────────

  describe('Document.getShareScope', () => {
    it('should return null for an unknown uuid', async () => {
      const scope = await Document.getShareScope(ctx, 'unknown-uuid-zzz');
      expect(scope).to.equal(null);
    });

    it('should resolve root + tree + include_subtree for a shared doc', async () => {
      const root = await createDocument(ctx, { title: 'Share Root' });
      const child = await createDocument(ctx, {
        title: 'Direct Child',
        parent_id: root.id,
      });
      const shared = await Document.share(ctx, root.id);

      const scope = await Document.getShareScope(ctx, shared.uuid!);

      expect(scope).to.not.equal(null);
      expect(scope!.root.id).to.equal(root.id);
      expect(scope!.includeSubtree).to.equal(true);
      // Tree carries root + direct children only (deeper levels are lazy).
      const treeIds = scope!.tree.map((n) => n.id);
      expect(treeIds).to.include(root.id);
      expect(treeIds).to.include(child.id);
    });

    it('should drop restricted direct children from the manifest tree', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const visibleChild = await createDocument(ctx, {
        title: 'Visible',
        parent_id: root.id,
      });
      const restrictedChild = await createDocument(ctx, {
        title: 'Restricted',
        parent_id: root.id,
      });
      const shared = await Document.share(ctx, root.id);
      await seedVisibilityRestriction(ctx, restrictedChild.id);

      const scope = await Document.getShareScope(ctx, shared.uuid!);

      const treeIds = scope!.tree.map((n) => n.id);
      expect(treeIds).to.include(root.id);
      expect(treeIds).to.include(visibleChild.id);
      expect(treeIds).to.not.include(restrictedChild.id);
    });

    it('should return just the root in the tree when include_subtree=false', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      await createDocument(ctx, { title: 'Child', parent_id: root.id });
      const shared = await Document.share(ctx, root.id);

      await Document.updateShareSettings(ctx, root.id, {
        include_subtree: false,
      });

      const scope = await Document.getShareScope(ctx, shared.uuid!);

      expect(scope!.includeSubtree).to.equal(false);
      expect(scope!.tree.length).to.equal(1);
      expect(scope!.tree[0].id).to.equal(root.id);
    });

    // Used to live as a defense-in-depth re-check in PublicDocsService.
    // Now folded into getShareScope so the model is the only gate.
    it('should return null when the root has a DOCUMENT_VISIBILITY restriction', async () => {
      const root = await createDocument(ctx, {
        title: 'About-To-Be-Restricted',
      });
      const shared = await Document.share(ctx, root.id);

      await seedVisibilityRestriction(ctx, root.id);

      const scope = await Document.getShareScope(ctx, shared.uuid!);
      expect(scope).to.equal(null);
    });
  });

  // ── Document.isReachable ────────────────────────────────────────

  describe('Document.isReachable', () => {
    it('should accept the root', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const shared = await Document.share(ctx, root.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, root.id)).to.equal(true);
    });

    it('should accept a direct child when include_subtree=true', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, {
        title: 'Child',
        parent_id: root.id,
      });
      const shared = await Document.share(ctx, root.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, child.id)).to.equal(true);
    });

    it('should accept a deep descendant when include_subtree=true', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, {
        title: 'Child',
        parent_id: root.id,
      });
      const grandchild = await createDocument(ctx, {
        title: 'Grandchild',
        parent_id: child.id,
      });
      const shared = await Document.share(ctx, root.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, grandchild.id)).to.equal(true);
    });

    it('should reject non-root docs when include_subtree=false', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, {
        title: 'Child',
        parent_id: root.id,
      });
      const shared = await Document.share(ctx, root.id);
      await Document.updateShareSettings(ctx, root.id, {
        include_subtree: false,
      });
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, root.id)).to.equal(true);
      expect(await Document.isReachable(scope, child.id)).to.equal(false);
    });

    it('should reject a doc that carries its own DOCUMENT_VISIBILITY row', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const restricted = await createDocument(ctx, {
        title: 'Restricted',
        parent_id: root.id,
      });
      const shared = await Document.share(ctx, root.id);
      await seedVisibilityRestriction(ctx, restricted.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, restricted.id)).to.equal(false);
    });

    it('should reject a descendant of a restricted ancestor', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const restricted = await createDocument(ctx, {
        title: 'Restricted',
        parent_id: root.id,
      });
      const grandchild = await createDocument(ctx, {
        title: 'Under Restricted',
        parent_id: restricted.id,
      });
      const shared = await Document.share(ctx, root.id);
      await seedVisibilityRestriction(ctx, restricted.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, grandchild.id)).to.equal(false);
    });

    it('should reject a doc that lives outside the share root', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const sibling = await createDocument(ctx, { title: 'Sibling' });
      const shared = await Document.share(ctx, root.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, sibling.id)).to.equal(false);
    });

    it('should reject a soft-deleted doc', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const child = await createDocument(ctx, {
        title: 'Child',
        parent_id: root.id,
      });
      const shared = await Document.share(ctx, root.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      await Document.softDelete(ctx, child.id);

      expect(await Document.isReachable(scope, child.id)).to.equal(false);
    });

    it('should reject an unknown doc id', async () => {
      const root = await createDocument(ctx, { title: 'Root' });
      const shared = await Document.share(ctx, root.id);
      const scope = (await Document.getShareScope(ctx, shared.uuid!))!;

      expect(await Document.isReachable(scope, 'doc_does_not_exist')).to.equal(
        false,
      );
    });
  });

  // ── Cache invalidation flow (end-to-end) ────────────────────────

  describe('Cache invalidation', () => {
    it('should reflect updateShareSettings on the next share-scope read', async () => {
      const root = await createDocument(ctx, { title: 'Toggle Subtree' });
      await createDocument(ctx, { title: 'Child', parent_id: root.id });
      const shared = await Document.share(ctx, root.id);

      const before = await Document.getShareScope(ctx, shared.uuid!);
      expect(before!.includeSubtree).to.equal(true);

      await Document.updateShareSettings(ctx, root.id, {
        include_subtree: false,
      });

      const after = await Document.getShareScope(ctx, shared.uuid!);
      expect(after!.includeSubtree).to.equal(false);
      expect(after!.tree.length).to.equal(1);
    });

    it('should drop the uuid→doc cache on unshare', async () => {
      const doc = await createDocument(ctx, { title: 'Unshare Drops Cache' });
      const shared = await Document.share(ctx, doc.id);

      await Document.getByUUID(ctx, shared.uuid!);
      const cacheKey = `${CacheScope.DOCUMENT}:uuid:${shared.uuid}`;
      const primed = await NocoCache.get(
        'root',
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );
      expect(primed).to.exist;

      await Document.unshare(ctx, doc.id);

      const cleared = await NocoCache.get(
        'root',
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );
      expect(cleared).to.not.exist;
    });

    it('should drop the uuid→doc cache on hard delete', async () => {
      const doc = await createDocument(ctx, { title: 'Hard Delete' });
      const shared = await Document.share(ctx, doc.id);

      await Document.getByUUID(ctx, shared.uuid!);
      const cacheKey = `${CacheScope.DOCUMENT}:uuid:${shared.uuid}`;
      expect(await NocoCache.get('root', cacheKey, CacheGetType.TYPE_OBJECT)).to
        .exist;

      await Document.delete(ctx, doc.id);

      const cleared = await NocoCache.get(
        'root',
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );
      expect(cleared).to.not.exist;
    });

    // Regression: editing a shared root's own fields (title / icon / meta)
    // used to leave the uuid→doc cache untouched, so public readers saw
    // the pre-edit row until TTL expired (up to 1h).
    it('should drop the uuid→doc cache when the share root itself is updated', async () => {
      const doc = await createDocument(ctx, { title: 'Original Title' });
      const shared = await Document.share(ctx, doc.id);

      // Prime the uuid→doc cache via getByUUID.
      const fetchedBefore = await Document.getByUUID(ctx, shared.uuid!);
      expect(fetchedBefore!.title).to.equal('Original Title');

      await Document.update(ctx, doc.id, { title: 'New Title' });

      const fetchedAfter = await Document.getByUUID(ctx, shared.uuid!);
      expect(fetchedAfter!.title).to.equal('New Title');
    });
  });
}

export default function () {
  describe('Document Public Share', documentShareTests);
}
