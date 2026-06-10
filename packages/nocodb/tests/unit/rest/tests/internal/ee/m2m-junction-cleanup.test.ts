import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import init from '../../../../init';
import { createProject } from '../../../../factory/base';
import { createTable } from '../../../../factory/table';
import { createLtarColumn2, customColumns } from '../../../../factory/column';
import { Column, Model } from '~/models';
import BaseTrash from '~/models/BaseTrash';

/**
 * #9209 — deleting (trashing) one of several links to the SAME target table
 * must not leave the link's auto-created junction system hm-link active. If it
 * does, the optimised single-query keeps JOINing that junction and fails with
 * Postgres 42P01 ("table does not exist") once the junction is removed.
 */
export function m2mJunctionCleanupTests() {
  describe('m2m link delete — junction system-link cleanup (#9209)', () => {
    let context: any;
    let base: any;
    let ctx: { workspace_id: string; base_id: string };

    beforeEach(async () => {
      context = await init();
      base = await createProject(context);
      ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
    });

    const mkTable = (title: string) =>
      createTable(context, base, {
        title,
        table_name: title,
        columns: customColumns('custom', [
          {
            title: `${title}_pk`,
            column_name: `${title}_pk`,
            uidt: UITypes.SingleLineText,
            pv: true,
          },
        ]),
      });

    async function activeRefsToJunction(parentId: string, junctionId: string) {
      const m = await Model.get(ctx, parentId);
      const refs: string[] = [];
      for (const c of await m.getColumns(ctx)) {
        if (
          c.uidt !== UITypes.LinkToAnotherRecord &&
          c.uidt !== UITypes.Links
        ) {
          continue;
        }
        const co: any = await c.getColOptions(ctx).catch(() => null);
        if (
          co?.fk_mm_model_id === junctionId ||
          co?.fk_related_model_id === junctionId
        ) {
          refs.push(c.title as string);
        }
      }
      return refs;
    }

    const internalPost = (op: string, body: any) =>
      request(context.app)
        .post(`/api/v2/internal/${base.fk_workspace_id}/${base.id}`)
        .query({ operation: op })
        .set('xc-auth', context.token)
        .send(body);

    const trashColumn = (colId: string) =>
      request(context.app)
        .delete(`/api/v2/meta/columns/${colId}`)
        .set('xc-auth', context.token);

    const mkMmLink = (title: string, parentTable: any, childTable: any) =>
      createLtarColumn2(context, { title, parentTable, childTable, type: 'mm' });

    const recordedSystemLinkIds = async (colId: string) => {
      const e = await BaseTrash.getByResourceId(ctx, 'field', colId);
      return {
        entry: e!,
        ids: (e!.getRelatedItems().junctionSystemLinks ?? []).map((l) => l.id),
      };
    };

    const getColOrNull = (colId: string) =>
      Column.get(ctx, { colId, includeDeleted: true }, undefined as any).catch(
        () => null,
      );

    // #3 purge: trashing then permanently deleting a junction-backed link must
    // hard-delete its system hm-link(s) too — not leave soft-deleted orphans.
    it('permanent delete removes the junction system-links (no orphans)', async () => {
      const websites = await mkTable('Websites');
      const backlinks = await mkTable('Backlinks');
      await mkMmLink('LinkA', websites, backlinks);
      const linkB = await mkMmLink('LinkB', websites, backlinks);

      const junctionId = ((await (
        await Column.get(ctx, { colId: linkB.id })
      ).getColOptions(ctx)) as any).fk_mm_model_id;

      await trashColumn(linkB.id).expect(200);
      const { entry, ids } = await recordedSystemLinkIds(linkB.id);
      expect(ids.length, 'recorded system-links').to.be.greaterThan(0);

      await internalPost('baseTrashPermanentDelete', {
        trashId: entry.id,
      }).expect(200);

      for (const id of ids) {
        expect(await getColOrNull(id), `system-link ${id} purged`).to.not.exist;
      }
      const j = await Model.get(ctx, junctionId, true).catch(() => null);
      expect(j, 'junction model purged').to.not.exist;

      const read = await request(context.app)
        .get(`/api/v2/tables/${websites.id}/records?limit=5`)
        .set('xc-auth', context.token);
      expect(read.status, JSON.stringify(read.body)).to.be.within(200, 299);
    });

    // #4 deferred restore: trash the link, trash its related table, then restore
    // the link (deferred → placeholder). The recorded system-links must be
    // reactivated at conversion time, not orphaned.
    it('deferred restore reactivates the junction system-links', async () => {
      const websites = await mkTable('Websites');
      const backlinks = await mkTable('Backlinks');
      await mkMmLink('LinkA', websites, backlinks);
      const linkB = await mkMmLink('LinkB', websites, backlinks);

      await trashColumn(linkB.id).expect(200);
      const { entry, ids } = await recordedSystemLinkIds(linkB.id);
      expect(ids.length).to.be.greaterThan(0);

      // trash the related table → restoring LinkB now defers
      await request(context.app)
        .delete(`/api/v2/meta/tables/${backlinks.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      await internalPost('baseTrashRestore', { trashId: entry.id }).expect(200);

      for (const id of ids) {
        const c: any = await getColOrNull(id);
        expect(c && c.deleted !== true, `system-link ${id} reactivated`).to.eq(
          true,
        );
      }
    });

    it('trashing one of several links to the same target leaves no active reference to its junction', async () => {
      const websites = await mkTable('Websites');
      const backlinks = await mkTable('Backlinks');

      await createLtarColumn2(context, {
        title: 'LinkA',
        parentTable: websites,
        childTable: backlinks,
        type: 'mm',
      });
      const linkB = await createLtarColumn2(context, {
        title: 'LinkB',
        parentTable: websites,
        childTable: backlinks,
        type: 'mm',
      });
      await createLtarColumn2(context, {
        title: 'LinkC',
        parentTable: websites,
        childTable: backlinks,
        type: 'mm',
      });

      const lbCo: any = await (
        await Column.get(ctx, { colId: linkB.id })
      ).getColOptions(ctx);
      const junctionId = lbCo.fk_mm_model_id;

      await request(context.app)
        .delete(`/api/v2/meta/columns/${linkB.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // no ACTIVE column on the parent may still reference the trashed link's junction
      expect(await activeRefsToJunction(websites.id, junctionId)).to.deep.equal(
        [],
      );

      // the optimised read path must not 42P01
      const read = await request(context.app)
        .get(`/api/v2/tables/${websites.id}/records?limit=5`)
        .set('xc-auth', context.token);
      expect(read.status, JSON.stringify(read.body)).to.be.within(200, 299);

      // the soft-deleted junction system-link(s) are recorded so restore can reactivate them
      const entry = await BaseTrash.getByResourceId(ctx, 'field', linkB.id);
      const ri = entry?.getRelatedItems?.() ?? {};
      expect(
        ri.junctionSystemLinks,
        'records junction system-links for restore',
      )
        .to.be.an('array')
        .that.is.not.empty;

      // ── restore round-trip ──────────────────────────────────────────
      // restoring the link must reactivate its junction system-link(s), so the
      // junction is joined again and the read still succeeds.
      await request(context.app)
        .post(`/api/v2/internal/${base.fk_workspace_id}/${base.id}`)
        .query({ operation: 'baseTrashRestore' })
        .set('xc-auth', context.token)
        .send({ trashId: entry!.id })
        .expect(200);

      const refsAfterRestore = await activeRefsToJunction(
        websites.id,
        junctionId,
      );
      expect(
        refsAfterRestore.length,
        'restore reactivates the junction system-link(s)',
      ).to.be.greaterThan(0);

      const readAfterRestore = await request(context.app)
        .get(`/api/v2/tables/${websites.id}/records?limit=5`)
        .set('xc-auth', context.token);
      expect(
        readAfterRestore.status,
        JSON.stringify(readAfterRestore.body),
      ).to.be.within(200, 299);
    });
  });
}
