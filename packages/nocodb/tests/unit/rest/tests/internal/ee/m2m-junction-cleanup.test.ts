import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import init from '../../../../init';
import { createProject } from '../../../../factory/base';
import { createTable } from '../../../../factory/table';
import {
  createColumn,
  createLtarColumn2,
  customColumns,
} from '../../../../factory/column';
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

    // #2 cross-base: the far-side system hm-link lives in another base. Trashing
    // the link must soft-delete it there (was deterministically skipped), and
    // restore must reactivate it.
    // active SYSTEM hm-links to the junction (fk_related_model_id === junction) —
    // the columns this fix is responsible for (the inverse *user* mm link, which
    // has fk_mm_model_id === junction, is the reverseCol's domain, not this fix's).
    const activeSystemLinksTo = async (
      sideCtx: { workspace_id: string; base_id: string },
      tableId: string,
      junctionId: string,
    ) => {
      const m = await Model.get(sideCtx, tableId);
      const refs: string[] = [];
      for (const c of await m.getColumns(sideCtx)) {
        if (!isLinksOrLTAR(c)) continue;
        const co: any = await c.getColOptions(sideCtx).catch(() => null);
        if (co?.fk_related_model_id === junctionId) {
          refs.push(c.title as string);
        }
      }
      return refs;
    };

    it('trashing a cross-base link soft-deletes the far-side junction system-link in its own base', async () => {
      const base2 = await createProject(context);
      const ctx2 = { workspace_id: base2.fk_workspace_id, base_id: base2.id };

      const websites = await mkTable('Websites'); // base (base1)
      const backlinks = await createTable(context, base2, {
        title: 'Backlinks',
        table_name: 'Backlinks',
        columns: customColumns('custom', [
          { title: 'pk', column_name: 'pk', uidt: UITypes.SingleLineText, pv: true },
        ]),
      });

      // cross-base mm link Websites(base1) -> Backlinks(base2)
      const link = await createColumn(context, websites, {
        title: 'CrossLink',
        column_name: 'CrossLink',
        uidt: UITypes.LinkToAnotherRecord,
        parentId: websites.id,
        childId: backlinks.id,
        ref_base_id: base2.id,
        type: 'mm',
      });

      const linkCo: any = await (
        await Column.get(ctx, { colId: link.id })
      ).getColOptions(ctx);
      const junctionId = linkCo.fk_mm_model_id;
      expect(junctionId, 'cross-base mm link is junction-backed').to.exist;

      await trashColumn(link.id).expect(200);

      // far side (base2) must have no active reference to the junction
      const sysLinks = await activeSystemLinksTo(ctx2, backlinks.id, junctionId);
      expect(sysLinks).to.deep.equal([]);

      // it was recorded under base2 so restore/purge can reach it
      const entry = await BaseTrash.getByResourceId(ctx, 'field', link.id);
      const links = entry!.getRelatedItems().junctionSystemLinks ?? [];
      expect(
        links.some((l) => l.base_id === base2.id),
        'records a far-side (base2) system-link',
      ).to.eq(true);

      // restore reactivates it in base2
      await internalPost('baseTrashRestore', { trashId: entry!.id }).expect(200);
      expect(
        (await activeSystemLinksTo(ctx2, backlinks.id, junctionId)).length,
        'restore reactivates the far-side system-link',
      ).to.be.greaterThan(0);
    });

    // #1 (critical guard): trashing a CUSTOM junction-backed link must NOT
    // soft-delete genuine user links pointing at its junction — because a custom
    // link's junction is a real user table, not an auto-junction.
    it('trashing a custom link does not soft-delete genuine user links to its junction table', async () => {
      const numCol = (t: string) => ({
        title: t,
        column_name: t,
        uidt: UITypes.SingleLineText,
      });
      // J is a real table used as the custom junction (has FK-style columns)
      const actor = await mkTable('Actor');
      const film = await mkTable('Film');
      const junc = await createTable(context, base, {
        title: 'ActorFilm',
        table_name: 'ActorFilm',
        columns: customColumns('custom', [
          { title: 'pk', column_name: 'pk', uidt: UITypes.SingleLineText, pv: true },
          numCol('ActorId'),
          numCol('FilmId'),
        ]),
      });

      const actorPk = (await actor.getColumns(ctx)).find((c) => c.pv);
      const filmPk = (await film.getColumns(ctx)).find((c) => c.pv);
      const juncCols = await junc.getColumns(ctx);
      const juncActorFk = juncCols.find((c) => c.title === 'ActorId');
      const juncFilmFk = juncCols.find((c) => c.title === 'FilmId');

      // custom mm link Actor → Film via the real ActorFilm junction
      await request(context.app)
        .post(`/api/v1/db/meta/tables/${actor.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Films',
          uidt: UITypes.Links,
          childId: film.id,
          parentId: actor.id,
          column_name: 'Films',
          type: 'mm',
          is_custom_link: true,
          custom: {
            base_id: base.id,
            junc_base_id: base.id,
            column_id: actorPk!.id,
            junc_model_id: junc.id,
            junc_column_id: juncActorFk!.id,
            junc_ref_column_id: juncFilmFk!.id,
            ref_model_id: film.id,
            ref_column_id: filmPk!.id,
          },
        })
        .expect(200);

      const customLink = (await actor.getColumns(ctx)).find(
        (c) => c.title === 'Films',
      )!;

      // a GENUINE user link on Actor pointing at the junction table (ActorFilm)
      const userLink = await mkMmLink('ActorToJunction', actor, junc);

      // trash the custom link
      await trashColumn(customLink.id).expect(200);

      // the genuine user link must NOT have been soft-deleted by the scan
      const survivor: any = await getColOrNull(userLink.id);
      expect(survivor, 'user link still exists').to.exist;
      expect(survivor.deleted, 'user link not soft-deleted').to.not.equal(true);
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
