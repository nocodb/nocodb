import { expect } from 'chai';
import request from 'supertest';
import { UITypes, RelationTypes, LinksVersion } from 'nocodb-sdk';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import {
  createColumn,
  createLookupColumn,
  customColumns,
} from '../../../factory/column';
import { createBulkRows } from '../../../factory/row';
import { createTable } from '../../../factory/table';
import type { ITestContext } from '../../../init';
import type { ColumnType } from 'nocodb-sdk';
import type { Model } from '~/models';

/**
 * Full coverage for the per-LTAR `fk_display_value_column_id` override.
 *
 * Covers the matrix of (uidt × relation-type × links version):
 *   V1 LTAR (uidt = LinkToAnotherRecord) : hm, bt, oo, mm (traditional)
 *   V2 LTAR (uidt = Links)              : mm, om, mo, oo
 *
 * Per combination: (a) persistence on create, (b) PATCH update/clear,
 * (c) list response carries the override column. Plus a column-delete
 * cascade test that covers the null-on-delete cleanup.
 */
describe('dataApiV3', () => {
  // Custom display value field is gated as an EE-only feature in the backend
  // (see resolveDisplayValueColumnOrThrow in columns.service.ts). The
  // ltar-custom-display-value suite therefore only runs against the EE build.
  if (process.env.EE !== 'true') return;

  describe('ltar-custom-display-value', () => {
    let testContext: ITestContext;
    // Two neutral-named tables so the tests read without HM/BT bias.
    // Each table has a PV (Title) and a secondary col (Label) to act as the
    // custom display value target.
    let tblA: Model;
    let tblB: Model;
    let colsA: ColumnType[];
    let colsB: ColumnType[];

    const getToken = () => testContext.context.token;
    const getApp = () => testContext.context.app;

    const findCol = (cols: ColumnType[], title: string) =>
      cols.find((c) => c.title === title) as ColumnType;

    const createLtar = async (
      parentTable: Model,
      childTable: Model,
      title: string,
      opts: {
        uidt: UITypes;
        type: RelationTypes;
        version?: LinksVersion;
        fk_display_value_column_id?: string | null;
      },
      expectStatus = 200,
    ) => {
      const body: Record<string, any> = {
        title,
        column_name: title,
        uidt: opts.uidt,
        parentId: parentTable.id,
        childId: childTable.id,
        type: opts.type,
      };
      if (opts.version != null) body.version = opts.version;
      if (opts.fk_display_value_column_id !== undefined) {
        body.fk_display_value_column_id = opts.fk_display_value_column_id;
      }
      const res = await request(getApp())
        .post(`/api/v1/db/meta/tables/${parentTable.id}/columns`)
        .set('xc-auth', getToken())
        .send(body);
      expect(res.status, `create ${title}: ${JSON.stringify(res.body)}`).to.equal(expectStatus);
      if (expectStatus !== 200) return res;
      const ctx = {
        workspace_id: parentTable.fk_workspace_id,
        base_id: parentTable.base_id,
      };
      // V1 BT lands the user-facing column on the child side (the BT half of
      // createHmAndBtColumn is the one that receives colExtra). For every
      // other relation type it lives on parentTable.
      const owner =
        opts.type === RelationTypes.BELONGS_TO ? childTable : parentTable;
      return (await owner.getColumns(ctx)).find((c) => c.title === title);
    };

    const patchColumn = async (
      columnId: string,
      body: Record<string, any>,
      expectStatus = 200,
    ) => {
      const res = await request(getApp())
        .patch(`/api/v2/meta/columns/${columnId}`)
        .set('xc-auth', getToken())
        .send(body);
      expect(res.status, `patch ${columnId}: ${JSON.stringify(res.body)}`).to.equal(expectStatus);
      return res;
    };

    const getColumn = async (columnId: string) => {
      const res = await request(getApp())
        .get(`/api/v2/meta/columns/${columnId}`)
        .set('xc-auth', getToken());
      expect(res.status).to.equal(200);
      return res.body;
    };

    // V3 with linksAsLtar=true so V2 Links columns expand into nested records
    // (V1 API keeps them as counts, which is why this test file avoids it).
    const listRows = async (tableId: string) => {
      const res = await request(getApp())
        .get(`/api/v3/data/${testContext.base.id}/${tableId}/records`)
        .set('xc-auth', getToken())
        .query({ limit: 100, linksAsLtar: 'true' });
      expect(res.status).to.equal(200);
      return res.body.records as any[];
    };

    const linkV3 = async (
      tableId: string,
      linkColumnId: string,
      rowId: string,
      linkId: string,
    ) => {
      const res = await request(getApp())
        .post(
          `/api/v3/data/${testContext.base.id}/${tableId}/links/${linkColumnId}/${rowId}`,
        )
        .set('xc-auth', getToken())
        .send({ id: linkId });
      expect(res.status).to.be.oneOf([200, 201]);
    };

    const assertPersisted = async (
      column: any,
      expectedDisplayColId: string | null,
    ) => {
      expect(column?.colOptions?.fk_display_value_column_id).to.equal(
        expectedDisplayColId,
      );
    };

    beforeEach(async () => {
      testContext = (await dataApiV3BeforeEach()) as unknown as ITestContext;

      const makeCols = (prefix: string) =>
        customColumns('custom', [
          {
            title: 'Title',
            column_name: 'Title',
            uidt: UITypes.SingleLineText,
            pv: true,
          },
          {
            title: 'Label',
            column_name: 'Label',
            uidt: UITypes.SingleLineText,
          },
        ]);

      tblA = await createTable(testContext.context, testContext.base, {
        title: 'TblA',
        table_name: 'TblA',
        columns: makeCols('A'),
      });
      tblB = await createTable(testContext.context, testContext.base, {
        title: 'TblB',
        table_name: 'TblB',
        columns: makeCols('B'),
      });

      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblA,
        values: [
          { Title: 'A1', Label: 'A-one' },
          { Title: 'A2', Label: 'A-two' },
        ],
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblB,
        values: [
          { Title: 'B1', Label: 'B-one' },
          { Title: 'B2', Label: 'B-two' },
        ],
      });

      const ctx = {
        workspace_id: testContext.base.fk_workspace_id,
        base_id: testContext.base.id,
      };
      colsA = await tblA.getColumns(ctx);
      colsB = await tblB.getColumns(ctx);
    });

    // ----------------------------------------------------------------------
    // V1 LTAR (uidt = LinkToAnotherRecord)
    // ----------------------------------------------------------------------

    describe('V1 LTAR (uidt=LinkToAnotherRecord)', () => {
      it('HM persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'HM_V1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });

      it('BT persists fk_display_value_column_id on create', async () => {
        // V1 BT quirk: the BT column lands on `child` (= childId = refTable
        // in service) with fk_related_model_id pointing to `parent`
        // (= parentId = table). The "linked" table the BT references is
        // therefore parentId. The service validates the override against
        // parentId's columns; the post-fix code does exactly that.
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblB, tblA, 'BT_V1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.BELONGS_TO,
          // Override is from parentId-side (tblB = `table` in service)
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });

      it('OO persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'OO_V1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.ONE_TO_ONE,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });

      it('MM (traditional) persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'MM_V1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.MANY_TO_MANY,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });
    });

    // ----------------------------------------------------------------------
    // V2 LTAR (uidt = Links, version = 2)
    // ----------------------------------------------------------------------

    describe('V2 LTAR (uidt=Links, version=2)', () => {
      it('MM V2 persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'MM_V2', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });

      it('OM V2 persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'OM_V2', {
          uidt: UITypes.Links,
          type: RelationTypes.ONE_TO_MANY,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });

      it('MO V2 persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'MO_V2', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_ONE,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });

      it('OO V2 persists fk_display_value_column_id on create', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'OO_V2', {
          uidt: UITypes.Links,
          type: RelationTypes.ONE_TO_ONE,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);
      });
    });

    // ----------------------------------------------------------------------
    // Validation
    // ----------------------------------------------------------------------

    describe('validation', () => {
      it('silently clears override when column id does not exist', async () => {
        // Non-existent ids are a schema-drift signal (stale client cache,
        // undo/redo mid-session). The create path coerces them to null
        // instead of 400-ing so the user's link is still created.
        const col: any = await createLtar(tblA, tblB, 'BadV1HM', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
          fk_display_value_column_id: 'does_not_exist_12345',
        });
        await assertPersisted(col, null);
      });

      it('PATCH clears override when set to null', async () => {
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'ClearHM', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);

        await patchColumn((col as any).id, {
          fk_display_value_column_id: null,
        });
        const fetched = await getColumn((col as any).id);
        expect(fetched.colOptions.fk_display_value_column_id).to.be.null;
        // a partial PATCH (no title in body) must not wipe the column alias
        expect(fetched.title).to.equal('ClearHM');
      });

      it('PATCH swaps override between columns', async () => {
        const titleB = findCol(colsB, 'Title');
        const labelB = findCol(colsB, 'Label');
        const col = await createLtar(tblA, tblB, 'SwapHM', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
          fk_display_value_column_id: labelB.id,
        });
        await assertPersisted(col, labelB.id);

        await patchColumn((col as any).id, {
          fk_display_value_column_id: titleB.id,
        });
        const fetched = await getColumn((col as any).id);
        expect(fetched.colOptions.fk_display_value_column_id).to.equal(
          titleB.id,
        );
      });
    });

    // ----------------------------------------------------------------------
    // List response carries the override column for all variants
    // ----------------------------------------------------------------------

    describe('list response includes override column', () => {
      const runListCase = async (
        title: string,
        opts: {
          uidt: UITypes;
          type: RelationTypes;
          version?: LinksVersion;
        },
      ) => {
        const labelB = findCol(colsB, 'Label');
        const linkCol: any = await createLtar(tblA, tblB, title, {
          ...opts,
          fk_display_value_column_id: labelB.id,
        });
        expect(linkCol.colOptions.fk_display_value_column_id).to.equal(
          labelB.id,
        );

        // Link TblA.row1 → TblB.row1. V3 records have the shape
        // { id, id_fields, fields: { ... } }; nested LTAR rows follow the
        // same shape under `fields[<ltarTitle>]`.
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));

        const rowsAAfter = await listRows(tblA.id);
        const a1After = rowsAAfter.find((r) => r.fields?.Title === 'A1');
        const nested = a1After.fields[title];
        const linked = Array.isArray(nested) ? nested[0] : nested;
        expect(linked, `${title}: nested payload must exist`).to.exist;
        expect(
          linked.fields.Label,
          `${title}: override col Label must be present`,
        ).to.equal('B-one');
      };

      it('V1 HM', async () => {
        await runListCase('ListHMV1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
        });
      });

      it('V1 MM', async () => {
        await runListCase('ListMMV1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.MANY_TO_MANY,
        });
      });

      it('V2 MM', async () => {
        await runListCase('ListMMV2', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
      });

      it('V2 OM', async () => {
        await runListCase('ListOMV2', {
          uidt: UITypes.Links,
          type: RelationTypes.ONE_TO_MANY,
          version: LinksVersion.V2,
        });
      });
    });

    // ----------------------------------------------------------------------
    // Lookup of an LTAR carries the override column (issue #9211)
    // ----------------------------------------------------------------------

    describe('lookup of LTAR includes override column', () => {
      // Lookup-of-LTAR payloads may arrive as a single object or an array,
      // with nested rows either plain title-keyed or V3 `{ id, fields }`.
      const extractNestedValues = (nested: any): any[] => {
        if (!nested) return [];
        const items = Array.isArray(nested) ? nested : [nested];
        return items.map((item) => item?.fields ?? item);
      };

      // Like factory createLookupColumn, but by ids — needed when the target
      // is an auto-created inverse column the factory's title-based column
      // resolution doesn't see.
      const createLookupByIds = async (
        table: Model,
        title: string,
        relationColumnId: string,
        lookupColumnId: string,
      ) => {
        const res = await request(getApp())
          .post(`/api/v1/db/meta/tables/${table.id}/columns`)
          .set('xc-auth', getToken())
          .send({
            title,
            column_name: title,
            uidt: UITypes.Lookup,
            fk_relation_column_id: relationColumnId,
            fk_lookup_column_id: lookupColumnId,
          });
        expect(
          res.status,
          `create lookup ${title}: ${JSON.stringify(res.body)}`,
        ).to.equal(200);
      };

      const runLookupCase = async (
        title: string,
        opts: {
          uidt: UITypes;
          type: RelationTypes;
          version?: LinksVersion;
        },
      ) => {
        const labelB = findCol(colsB, 'Label');

        // A → B link with the custom display value override. V1 BT lands the
        // user-facing column on the child side, so swap the table order there
        // to keep the link column (and its override) on tblA.
        const isV1Bt =
          opts.uidt === UITypes.LinkToAnotherRecord &&
          opts.type === RelationTypes.BELONGS_TO;
        const linkCol: any = isV1Bt
          ? await createLtar(tblB, tblA, title, {
              ...opts,
              fk_display_value_column_id: labelB.id,
            })
          : await createLtar(tblA, tblB, title, {
              ...opts,
              fk_display_value_column_id: labelB.id,
            });
        expect(linkCol.colOptions.fk_display_value_column_id).to.equal(
          labelB.id,
        );

        // C → A link + a Lookup in C surfacing A's link-to-B column. The
        // lookup recurses into the LTAR extraction with a scalar AST — the
        // path that used to drop the override column from the nested JSON.
        const tblC = await createTable(testContext.context, testContext.base, {
          title: `TblC${title}`,
          table_name: `TblC${title}`,
          columns: customColumns('custom', [
            {
              title: 'Title',
              column_name: 'Title',
              uidt: UITypes.SingleLineText,
              pv: true,
            },
          ]),
        });
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });

        const cToA: any = await createLtar(tblC, tblA, `${title}CA`, {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });

        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: `${title}LK`,
          table: tblC,
          relatedTableName: tblA.table_name,
          relatedTableColumnTitle: title,
          relationColumnId: cToA.id,
        });

        // Link A1 → B1 (through the override link) and C1 → A1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));

        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToA.id, String(c1.id), String(a1.id));

        const rowsCAfter = await listRows(tblC.id);
        const c1After = rowsCAfter.find((r) => r.fields?.Title === 'C1');
        const values = extractNestedValues(c1After.fields[`${title}LK`]);
        expect(
          values.length,
          `${title}: lookup payload must exist`,
        ).to.be.greaterThan(0);
        // Nested lookup rows are title-keyed on some relation paths and
        // column-id-keyed on others — accept either key for the override col.
        expect(
          values[0]?.[labelB.title] ?? values[0]?.[labelB.id],
          `${title}: override col Label must be present in lookup payload`,
        ).to.equal('B-one');
      };

      it('looked-up V2 MO (many-to-one — customer scenario)', async () => {
        await runLookupCase('LkMOV2', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_ONE,
          version: LinksVersion.V2,
        });
      });

      it('looked-up V1 HM', async () => {
        await runLookupCase('LkHMV1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
        });
      });

      it('looked-up V1 BT', async () => {
        await runLookupCase('LkBTV1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.BELONGS_TO,
        });
      });

      it('looked-up V1 MM', async () => {
        await runLookupCase('LkMMV1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.MANY_TO_MANY,
        });
      });

      it('looked-up V1 OO', async () => {
        await runLookupCase('LkOOV1', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.ONE_TO_ONE,
        });
      });

      it('looked-up V2 OO', async () => {
        await runLookupCase('LkOOV2', {
          uidt: UITypes.Links,
          type: RelationTypes.ONE_TO_ONE,
          version: LinksVersion.V2,
        });
      });

      // NOTE: lookups of V2 MM / OM `Links` columns are intentionally not
      // covered — the lookup extraction does not propagate `linksAsLtar`, so
      // they resolve to the rollup count (a number), which has no display
      // value to assert. The grid renders that count via the Links cell, so
      // the override cannot manifest (or break) there.

      it('looked-up V1 OO (bt side) — override on the inverse column', async () => {
        const ctx = {
          workspace_id: testContext.base.fk_workspace_id,
          base_id: testContext.base.id,
        };
        const labelA = findCol(colsA, 'Label');

        // OO A → B creates a symmetric column on tblB (meta.bt = true) that
        // relates back to tblA — the bt-side OO extraction branch.
        const ooCol: any = await createLtar(tblA, tblB, 'OoBtFwd', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.ONE_TO_ONE,
        });
        const symCol = (await tblB.getColumns(ctx)).find(
          (c) =>
            c.uidt === UITypes.LinkToAnotherRecord &&
            (c.colOptions as any)?.type === RelationTypes.ONE_TO_ONE &&
            (c.colOptions as any)?.fk_related_model_id === tblA.id,
        );
        expect(symCol, 'symmetric bt-side OO column must exist').to.exist;

        // Set the override on the inverse column — it points at tblA, so the
        // override is one of tblA's columns.
        await patchColumn(symCol.id, {
          fk_display_value_column_id: labelA.id,
        });

        // C → B link + a Lookup in C surfacing tblB's bt-side OO column
        const tblC = await createTable(testContext.context, testContext.base, {
          title: 'TblCOoBt',
          table_name: 'TblCOoBt',
          columns: customColumns('custom', [
            {
              title: 'Title',
              column_name: 'Title',
              uidt: UITypes.SingleLineText,
              pv: true,
            },
          ]),
        });
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });
        const cToB: any = await createLtar(tblC, tblB, 'OoBtCB', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupByIds(tblC, 'OoBtLK', cToB.id, symCol.id);

        // Link A1 ↔ B1 (via the forward OO col) and C1 → B1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, ooCol.id, String(a1.id), String(b1.id));
        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToB.id, String(c1.id), String(b1.id));

        const rowsCAfter = await listRows(tblC.id);
        const c1After = rowsCAfter.find((r) => r.fields?.Title === 'C1');
        const values = extractNestedValues(c1After.fields.OoBtLK);
        expect(values.length, 'bt-side OO lookup payload must exist').to.be
          .greaterThan(0);
        expect(
          values[0]?.[labelA.title] ?? values[0]?.[labelA.id],
          'override col Label (tblA) must be present in bt-side OO lookup payload',
        ).to.equal('A-one');
      });

      it('looked-up V1 BT (inverse of HM) — override on the inverse column', async () => {
        const ctx = {
          workspace_id: testContext.base.fk_workspace_id,
          base_id: testContext.base.id,
        };
        const labelA = findCol(colsA, 'Label');

        // HM A → B creates a symmetric BT column on tblB that relates back to
        // tblA — the same shape as a directly-created V1 BT, but exercising
        // the PATCH-override flow on the auto-created inverse column.
        const hmCol: any = await createLtar(tblA, tblB, 'BtInvFwd', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
        });
        const symCol = (await tblB.getColumns(ctx)).find(
          (c) =>
            c.uidt === UITypes.LinkToAnotherRecord &&
            (c.colOptions as any)?.type === RelationTypes.BELONGS_TO &&
            (c.colOptions as any)?.fk_related_model_id === tblA.id,
        );
        expect(symCol, 'symmetric BT column must exist').to.exist;

        await patchColumn(symCol.id, {
          fk_display_value_column_id: labelA.id,
        });

        // C → B link + a Lookup in C surfacing tblB's BT column
        const tblC = await createTable(testContext.context, testContext.base, {
          title: 'TblCBtInv',
          table_name: 'TblCBtInv',
          columns: customColumns('custom', [
            {
              title: 'Title',
              column_name: 'Title',
              uidt: UITypes.SingleLineText,
              pv: true,
            },
          ]),
        });
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });
        const cToB: any = await createLtar(tblC, tblB, 'BtInvCB', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupByIds(tblC, 'BtInvLK', cToB.id, symCol.id);

        // Link A1 → B1 (via the HM col) and C1 → B1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, hmCol.id, String(a1.id), String(b1.id));
        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToB.id, String(c1.id), String(b1.id));

        const rowsCAfter = await listRows(tblC.id);
        const c1After = rowsCAfter.find((r) => r.fields?.Title === 'C1');
        const values = extractNestedValues(c1After.fields.BtInvLK);
        expect(values.length, 'inverse BT lookup payload must exist').to.be
          .greaterThan(0);
        expect(
          values[0]?.[labelA.title] ?? values[0]?.[labelA.id],
          'override col Label (tblA) must be present in inverse BT lookup payload',
        ).to.equal('A-one');
      });

      it('chained lookup (lookup → lookup → LTAR)', async () => {
        const labelB = findCol(colsB, 'Label');

        // A → B link with override
        const linkCol: any = await createLtar(tblA, tblB, 'ChainLink', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_ONE,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });

        const makeTable = async (name: string) =>
          createTable(testContext.context, testContext.base, {
            title: name,
            table_name: name,
            columns: customColumns('custom', [
              {
                title: 'Title',
                column_name: 'Title',
                uidt: UITypes.SingleLineText,
                pv: true,
              },
            ]),
          });

        // C looks up A's link; D looks up C's lookup — the LTAR extraction is
        // reached through two scalar-AST hops.
        const tblC = await makeTable('TblCChain');
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });
        const cToA: any = await createLtar(tblC, tblA, 'ChainCA', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'ChainLK1',
          table: tblC,
          relatedTableName: tblA.table_name,
          relatedTableColumnTitle: 'ChainLink',
          relationColumnId: cToA.id,
        });

        const tblD = await makeTable('TblDChain');
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblD,
          values: [{ Title: 'D1' }],
        });
        const dToC: any = await createLtar(tblD, tblC, 'ChainDC', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'ChainLK2',
          table: tblD,
          relatedTableName: tblC.table_name,
          relatedTableColumnTitle: 'ChainLK1',
          relationColumnId: dToC.id,
        });

        // Link A1 → B1, C1 → A1, D1 → C1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));
        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToA.id, String(c1.id), String(a1.id));
        const rowsD = await listRows(tblD.id);
        const d1 = rowsD.find((r) => r.fields?.Title === 'D1');
        await linkV3(tblD.id, dToC.id, String(d1.id), String(c1.id));

        const rowsDAfter = await listRows(tblD.id);
        const d1After = rowsDAfter.find((r) => r.fields?.Title === 'D1');
        const values = extractNestedValues(d1After.fields.ChainLK2).flatMap(
          (v) => extractNestedValues(v),
        );
        expect(values.length, 'chained lookup payload must exist').to.be
          .greaterThan(0);
        expect(
          values[0]?.[labelB.title] ?? values[0]?.[labelB.id],
          'override col Label must survive a chained lookup',
        ).to.equal('B-one');
      });

      it('lookup payload without override keeps default PV (pass-through unchanged)', async () => {
        const titleB = findCol(colsB, 'Title');
        const labelB = findCol(colsB, 'Label');

        // A → B link WITHOUT an override — the widened scalar AST must stay
        // dormant: the lookup payload keeps the default PV and never grows
        // the Label column.
        const linkCol: any = await createLtar(tblA, tblB, 'PassThru', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_ONE,
          version: LinksVersion.V2,
        });

        const tblC = await createTable(testContext.context, testContext.base, {
          title: 'TblCPassThru',
          table_name: 'TblCPassThru',
          columns: customColumns('custom', [
            {
              title: 'Title',
              column_name: 'Title',
              uidt: UITypes.SingleLineText,
              pv: true,
            },
          ]),
        });
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });
        const cToA: any = await createLtar(tblC, tblA, 'PassThruCA', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'PassThruLK',
          table: tblC,
          relatedTableName: tblA.table_name,
          relatedTableColumnTitle: 'PassThru',
          relationColumnId: cToA.id,
        });

        // Link A1 → B1 and C1 → A1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));
        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToA.id, String(c1.id), String(a1.id));

        const rowsCAfter = await listRows(tblC.id);
        const c1After = rowsCAfter.find((r) => r.fields?.Title === 'C1');
        const values = extractNestedValues(c1After.fields.PassThruLK);
        expect(
          values.length,
          'pass-through lookup payload must exist',
        ).to.be.greaterThan(0);
        expect(
          values[0]?.[titleB.title] ?? values[0]?.[titleB.id],
          'default PV Title must be present in pass-through lookup payload',
        ).to.equal('B1');
        expect(
          values[0],
          'Label (title key) must be absent without an override',
        ).to.not.have.property(labelB.title);
        expect(
          values[0],
          'Label (id key) must be absent without an override',
        ).to.not.have.property(labelB.id);
      });

      it('changing the override updates lookup payloads immediately (dependent cache invalidation)', async () => {
        const titleB = findCol(colsB, 'Title');
        const labelB = findCol(colsB, 'Label');

        // A → B link WITH the override — tblC's lookup payload depends on it.
        const linkCol: any = await createLtar(tblA, tblB, 'CacheInv', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_ONE,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });

        const tblC = await createTable(testContext.context, testContext.base, {
          title: 'TblCCacheInv',
          table_name: 'TblCCacheInv',
          columns: customColumns('custom', [
            {
              title: 'Title',
              column_name: 'Title',
              uidt: UITypes.SingleLineText,
              pv: true,
            },
          ]),
        });
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });
        const cToA: any = await createLtar(tblC, tblA, 'CacheInvCA', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'CacheInvLK',
          table: tblC,
          relatedTableName: tblA.table_name,
          relatedTableColumnTitle: 'CacheInv',
          relationColumnId: cToA.id,
        });

        // Link A1 → B1 and C1 → A1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));
        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToA.id, String(c1.id), String(a1.id));

        const listC1Lookup = async () => {
          const rows = await listRows(tblC.id);
          const row = rows.find((r) => r.fields?.Title === 'C1');
          return extractNestedValues(row.fields.CacheInvLK);
        };

        // 1) Warm tblC's compiled single-query cache with the override active.
        const warm = await listC1Lookup();
        expect(
          warm[0]?.[labelB.title] ?? warm[0]?.[labelB.id],
          'override col Label must be present before the clear',
        ).to.equal('B-one');

        // 2) Clear the override on the A → B link. The list of tblC was
        // compiled and cached above — if clearDependentLookupModelCaches did
        // not bust it, the stale query would keep emitting Label.
        await patchColumn(linkCol.id, { fk_display_value_column_id: null });
        const cleared = await listC1Lookup();
        expect(
          cleared.length,
          'lookup payload must still exist after the clear',
        ).to.be.greaterThan(0);
        expect(
          cleared[0],
          'Label (title key) must disappear right after the override is cleared',
        ).to.not.have.property(labelB.title);
        expect(
          cleared[0],
          'Label (id key) must disappear right after the override is cleared',
        ).to.not.have.property(labelB.id);
        expect(
          cleared[0]?.[titleB.title] ?? cleared[0]?.[titleB.id],
          'default PV Title must return after the clear',
        ).to.equal('B1');

        // 3) Restore the override — the cache must be busted again.
        await patchColumn(linkCol.id, { fk_display_value_column_id: labelB.id });
        const restored = await listC1Lookup();
        expect(
          restored[0]?.[labelB.title] ?? restored[0]?.[labelB.id],
          'override col Label must be present again after the restore',
        ).to.equal('B-one');
      });

      it('formula referencing a link with override resolves the override column', async () => {
        const labelB = findCol(colsB, 'Label');

        const linkCol: any = await createLtar(tblA, tblB, 'FmlLink', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_ONE,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });

        // Link A1 → B1 before the formula reads the relation
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));

        const fmlCol = await createColumn(testContext.context, tblA, {
          title: 'FmlLinkF',
          column_name: 'FmlLinkF',
          uidt: UITypes.Formula,
          formula: '{FmlLink}',
          formula_raw: '{FmlLink}',
        });
        expect(fmlCol, 'formula column must be created').to.exist;

        const rowsAAfter = await listRows(tblA.id);
        const a1After = rowsAAfter.find((r) => r.fields?.Title === 'A1');
        expect(
          a1After.fields.FmlLinkF,
          'formula over an override link must resolve the override column',
        ).to.equal('B-one');
      });

      it('formula referencing a lookup-of-link resolves the override column', async () => {
        const labelB = findCol(colsB, 'Label');

        // V1 LTAR on purpose: the formula builder routes terminal V2 `Links`
        // columns through the rollup-count branch (same pre-existing
        // semantics as the data-path NOTE above), so only a terminal
        // uidt=LinkToAnotherRecord column reaches the fixed terminal-LTAR
        // branch of lookup-or-ltar-builder.
        const linkCol: any = await createLtar(tblA, tblB, 'FmlLk', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
          fk_display_value_column_id: labelB.id,
        });

        // C → A link + a Lookup in C surfacing A's link-to-B column, then a
        // formula over that lookup — the terminal-LTAR branch of
        // lookup-or-ltar-builder must resolve the override from the terminal
        // LTAR, not the first-hop relation column.
        const tblC = await createTable(testContext.context, testContext.base, {
          title: 'TblCFmlLk',
          table_name: 'TblCFmlLk',
          columns: customColumns('custom', [
            {
              title: 'Title',
              column_name: 'Title',
              uidt: UITypes.SingleLineText,
              pv: true,
            },
          ]),
        });
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table: tblC,
          values: [{ Title: 'C1' }],
        });
        const cToA: any = await createLtar(tblC, tblA, 'FmlLkCA', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
        });
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'XLK',
          table: tblC,
          relatedTableName: tblA.table_name,
          relatedTableColumnTitle: 'FmlLk',
          relationColumnId: cToA.id,
        });

        // Link A1 → B1 and C1 → A1
        const rowsA = await listRows(tblA.id);
        const rowsB = await listRows(tblB.id);
        const a1 = rowsA.find((r) => r.fields?.Title === 'A1');
        const b1 = rowsB.find((r) => r.fields?.Title === 'B1');
        await linkV3(tblA.id, linkCol.id, String(a1.id), String(b1.id));
        const rowsC = await listRows(tblC.id);
        const c1 = rowsC.find((r) => r.fields?.Title === 'C1');
        await linkV3(tblC.id, cToA.id, String(c1.id), String(a1.id));

        const fmlCol = await createColumn(testContext.context, tblC, {
          title: 'XLKF',
          column_name: 'XLKF',
          uidt: UITypes.Formula,
          formula: '{XLK}',
          formula_raw: '{XLK}',
        });
        expect(fmlCol, 'formula column must be created').to.exist;

        const rowsCAfter = await listRows(tblC.id);
        const c1After = rowsCAfter.find((r) => r.fields?.Title === 'C1');
        expect(
          c1After.fields.XLKF,
          'formula over a lookup-of-link must resolve the override column',
        ).to.equal('B-one');
      });
    });

    // ----------------------------------------------------------------------
    // Column-delete cascade (target col deletion nulls the override)
    // ----------------------------------------------------------------------

    describe('column delete cascade', () => {
      it('nulls fk_display_value_column_id on all LTARs when target col is deleted', async () => {
        const labelB = findCol(colsB, 'Label');

        // Create TWO LTARs (different relation types) pointing at the same
        // target col so we prove the cleanup isn't relation-type specific.
        const hmCol: any = await createLtar(tblA, tblB, 'DelHM', {
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.HAS_MANY,
          fk_display_value_column_id: labelB.id,
        });
        const mmCol: any = await createLtar(tblA, tblB, 'DelMM', {
          uidt: UITypes.Links,
          type: RelationTypes.MANY_TO_MANY,
          version: LinksVersion.V2,
          fk_display_value_column_id: labelB.id,
        });

        const delRes = await request(getApp())
          .delete(`/api/v2/meta/columns/${labelB.id}`)
          .set('xc-auth', getToken());
        expect(delRes.status).to.equal(200);

        const hmAfter = await getColumn(hmCol.id);
        const mmAfter = await getColumn(mmCol.id);
        expect(hmAfter.colOptions.fk_display_value_column_id).to.be.null;
        expect(mmAfter.colOptions.fk_display_value_column_id).to.be.null;
      });
    });
  });
});
