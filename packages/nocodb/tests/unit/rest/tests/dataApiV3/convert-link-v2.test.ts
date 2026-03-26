import { expect } from 'chai';
import sinon from 'sinon';
import request from 'supertest';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import {
  createLtarColumn,
  createLtarColumn2,
  createLookupColumn,
  customColumns,
} from '../../../factory/column';
import { createBulkRows } from '../../../factory/row';
import { createTable } from '../../../factory/table';
import { ncAxios } from './ncAxios';
import { prepareRecords } from './helpers';
import { Column } from '../../../../../src/models';
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk';
import type { Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

interface ITestContext {
  context: any;
  ctx: { workspace_id: string; base_id: string };
  base: any;
}

describe('dataApiV3', () => {
  describe('convertLinkToV2', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
    });

    async function createTableWithRows(name: string, count: number) {
      const columns = [
        {
          title: name,
          column_name: name,
          uidt: UITypes.SingleLineText,
          pv: true,
        },
      ];
      const table = await createTable(testContext.context, testContext.base, {
        title: name,
        table_name: name,
        columns: customColumns('custom', columns),
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table,
        values: prepareRecords(name, count, 1, { ignoreId: true }),
      });
      return table;
    }

    async function getColumns(tableId: string): Promise<ColumnType[]> {
      const rsp = await request(testContext.context.app)
        .get(`/api/v1/db/meta/tables/${tableId}`)
        .set('xc-auth', testContext.context.token)
        .expect(200);
      return rsp.body.columns;
    }

    async function callConvertToV2(columnId: string, expectedStatus = 200) {
      const { base } = testContext;
      const rsp = await request(testContext.context.app)
        .post(`/api/v2/internal/${base.fk_workspace_id}/${base.id}`)
        .set('xc-auth', testContext.context.token)
        .query({ operation: 'convertLinkToV2', columnId })
        .send({});
      expect(rsp.status, `Convert failed: ${JSON.stringify(rsp.body)}`).to.equal(expectedStatus);
      return rsp;
    }

    function findCol(cols: ColumnType[], predicate: (c: ColumnType) => boolean) {
      return cols.find(predicate);
    }

    function getOpts(col: ColumnType): LinkToAnotherRecordType | undefined {
      return col?.colOptions as LinkToAnotherRecordType | undefined;
    }

    // ─── 1. HM Links → Rollup + LTAR ───────────────────────────

    describe('HM Links → Rollup + LTAR', () => {
      let tblParent: Model;
      let tblChild: Model;
      let hmColId: string;

      beforeEach(async () => {
        tblParent = await createTableWithRows('Parent', 3);
        tblChild = await createTableWithRows('Child', 5);

        await createLtarColumn(testContext.context, {
          title: 'Children',
          parentTable: tblParent,
          childTable: tblChild,
          type: 'hm',
        });

        const cols = await getColumns(tblParent.id);
        const hmCol = findCol(cols, (c) => c.title === 'Children');
        hmColId = hmCol.id;

        await ncAxiosLinkAdd({
          urlParams: { tableId: tblParent.id, linkId: hmColId, rowId: '1' },
          body: [{ id: 1 }, { id: 2 }, { id: 3 }],
        });
        await ncAxiosLinkAdd({
          urlParams: { tableId: tblParent.id, linkId: hmColId, rowId: '2' },
          body: [{ id: 4 }, { id: 5 }],
        });
      });

      it('converts to Rollup + new LTAR with data preserved', async () => {
        await callConvertToV2(hmColId);

        const cols = await getColumns(tblParent.id);

        // Original became Rollup
        const rollupCol = findCol(cols, (c) => c.title === 'Children');
        expect(rollupCol.uidt).to.equal(UITypes.Rollup);

        // New LTAR column created (find by title prefix or by being the non-system LTAR)
        const ltarCol = findCol(
          cols,
          (c) =>
            c.uidt === UITypes.LinkToAnotherRecord &&
            !c.system &&
            c.title !== 'Children' &&
            c.title !== '_nc_m2m_Parent_Children',
        );
        const allTitles = cols.map((c) => `${c.title}(${c.uidt})`).join(', ');
        expect(ltarCol, `LTAR column should exist. Columns: ${allTitles}`).to.not.be.undefined;

        const ltarOpts = getOpts(ltarCol);
        expect(ltarOpts, `colOptions should be populated for ${ltarCol.title}`).to.not.be.undefined;
        expect(ltarOpts.version).to.equal(2);
        expect(ltarOpts.type).to.equal(RelationTypes.ONE_TO_MANY);

        // Links preserved — use v2 link API directly since v3 may not support OM yet
        const links1Rsp = await request(testContext.context.app)
          .get(`/api/v2/tables/${tblParent.id}/links/${ltarCol.id}/records/1`)
          .set('xc-auth', testContext.context.token);
        expect(links1Rsp.status, `Link GET failed: ${JSON.stringify(links1Rsp.body)}`).to.equal(200);
        expect(links1Rsp.body.list).to.have.length(3);

        const links2Rsp = await request(testContext.context.app)
          .get(`/api/v2/tables/${tblParent.id}/links/${ltarCol.id}/records/2`)
          .set('xc-auth', testContext.context.token);
        expect(links2Rsp.status).to.equal(200);
        expect(links2Rsp.body.list).to.have.length(2);
      });

      it('rejects double conversion', async () => {
        await callConvertToV2(hmColId);

        const cols = await getColumns(tblParent.id);
        const ltarCol = findCol(
          cols,
          (c) => c.title?.startsWith('LTAR_') && c.uidt === UITypes.LinkToAnotherRecord,
        );

        await callConvertToV2(ltarCol.id, 400);
      });
    });

    // ─── 2. MM Links → Rollup + LTAR ───────────────────────────

    describe('MM Links → Rollup + LTAR', () => {
      let tblStudent: Model;
      let tblCourse: Model;
      let mmColId: string;

      beforeEach(async () => {
        tblStudent = await createTableWithRows('Student', 3);
        tblCourse = await createTableWithRows('Course', 3);

        await createLtarColumn(testContext.context, {
          title: 'Courses',
          parentTable: tblStudent,
          childTable: tblCourse,
          type: 'mm',
        });

        const cols = await getColumns(tblStudent.id);
        const mmCol = findCol(cols, (c) => c.title === 'Courses');
        mmColId = mmCol.id;

        await ncAxiosLinkAdd({
          urlParams: { tableId: tblStudent.id, linkId: mmColId, rowId: '1' },
          body: [{ id: 1 }, { id: 2 }],
        });
        await ncAxiosLinkAdd({
          urlParams: { tableId: tblStudent.id, linkId: mmColId, rowId: '2' },
          body: [{ id: 2 }, { id: 3 }],
        });
      });

      it('converts to Rollup + new LTAR with data preserved', async () => {
        await callConvertToV2(mmColId);

        const cols = await getColumns(tblStudent.id);

        // Original became Rollup
        const rollupCol = findCol(cols, (c) => c.title === 'Courses');
        expect(rollupCol.uidt).to.equal(UITypes.Rollup);

        // New LTAR column
        const ltarCol = findCol(
          cols,
          (c) => c.title?.startsWith('LTAR_') && c.uidt === UITypes.LinkToAnotherRecord,
        );
        expect(ltarCol, 'LTAR column should exist').to.not.be.undefined;
        expect(getOpts(ltarCol).version).to.equal(2);
        expect(getOpts(ltarCol).type).to.equal(RelationTypes.MANY_TO_MANY);

        // Links preserved via v2 API
        const links1Rsp = await request(testContext.context.app)
          .get(`/api/v2/tables/${tblStudent.id}/links/${ltarCol.id}/records/1`)
          .set('xc-auth', testContext.context.token);
        expect(links1Rsp.status, `Link GET failed: ${JSON.stringify(links1Rsp.body)}`).to.equal(200);
        expect(links1Rsp.body.list).to.have.length(2);
      });

      it('paired column on Course side also V2', async () => {
        await callConvertToV2(mmColId);

        const courseCols = await getColumns(tblCourse.id);
        const reverseCol = findCol(
          courseCols,
          (c) => getOpts(c)?.type === RelationTypes.MANY_TO_MANY && getOpts(c)?.version === 2,
        );
        expect(reverseCol).to.not.be.undefined;
      });
    });

    // ─── 3. BT Links → LTAR (no Rollup) ────────────────────────

    describe('BT Links → LTAR (no Rollup)', () => {
      let tblDept: Model;
      let tblEmp: Model;
      let btColId: string;

      beforeEach(async () => {
        tblDept = await createTableWithRows('Dept', 3);
        tblEmp = await createTableWithRows('Emp', 5);

        await createLtarColumn(testContext.context, {
          title: 'Employees',
          parentTable: tblDept,
          childTable: tblEmp,
          type: 'hm',
        });

        const empCols = await getColumns(tblEmp.id);
        const btCol = findCol(empCols, (c) => getOpts(c)?.type === RelationTypes.BELONGS_TO);
        btColId = btCol.id;

        // Link via HM side
        const deptCols = await getColumns(tblDept.id);
        const hmColId = findCol(deptCols, (c) => c.title === 'Employees').id;

        await ncAxiosLinkAdd({
          urlParams: { tableId: tblDept.id, linkId: hmColId, rowId: '1' },
          body: [{ id: 1 }, { id: 2 }],
        });
        await ncAxiosLinkAdd({
          urlParams: { tableId: tblDept.id, linkId: hmColId, rowId: '2' },
          body: [{ id: 3 }],
        });
      });

      it('converts BT to MO V2 without Rollup', async () => {
        await callConvertToV2(btColId);

        const empCols = await getColumns(tblEmp.id);

        // BT became MO V2
        const moCol = findCol(empCols, (c) => getOpts(c)?.type === RelationTypes.MANY_TO_ONE);
        expect(moCol, 'MO column should exist').to.not.be.undefined;
        expect(getOpts(moCol).version).to.equal(2);

        // No Rollup created on Employee side
        const rollups = empCols.filter((c) => c.uidt === UITypes.Rollup);
        expect(rollups).to.have.length(0);

        // Paired HM also converted (becomes OM or Rollup+LTAR)
        const deptCols = await getColumns(tblDept.id);
        const omCol = findCol(
          deptCols,
          (c) => getOpts(c)?.type === RelationTypes.ONE_TO_MANY && getOpts(c)?.version === 2,
        );
        expect(omCol, 'Paired OM column should exist').to.not.be.undefined;
      });
    });

    // ─── 4. OO Links → LTAR (no Rollup) ────────────────────────

    describe('OO Links → LTAR (no Rollup)', () => {
      let tblPerson: Model;
      let tblPassport: Model;
      let ooColId: string;

      beforeEach(async () => {
        tblPerson = await createTableWithRows('Person', 3);
        tblPassport = await createTableWithRows('Passport', 3);

        await createLtarColumn(testContext.context, {
          title: 'Passport',
          parentTable: tblPerson,
          childTable: tblPassport,
          type: 'oo',
        });

        const personCols = await getColumns(tblPerson.id);
        const ooCol = findCol(personCols, (c) => c.title === 'Passport');
        ooColId = ooCol.id;

        await ncAxiosLinkAdd({
          urlParams: { tableId: tblPerson.id, linkId: ooColId, rowId: '1' },
          body: [{ id: 1 }],
        });
        await ncAxiosLinkAdd({
          urlParams: { tableId: tblPerson.id, linkId: ooColId, rowId: '2' },
          body: [{ id: 2 }],
        });
      });

      it('converts OO to V2 without Rollup', async () => {
        await callConvertToV2(ooColId);

        const personCols = await getColumns(tblPerson.id);

        // OO stays OO but V2
        const ooCol = findCol(
          personCols,
          (c) => getOpts(c)?.type === RelationTypes.ONE_TO_ONE && getOpts(c)?.version === 2,
        );
        expect(ooCol, 'OO V2 column should exist').to.not.be.undefined;

        // No Rollup
        expect(personCols.filter((c) => c.uidt === UITypes.Rollup)).to.have.length(0);

        // Paired side also V2
        const passportCols = await getColumns(tblPassport.id);
        const reverseOO = findCol(
          passportCols,
          (c) => getOpts(c)?.type === RelationTypes.ONE_TO_ONE && getOpts(c)?.version === 2,
        );
        expect(reverseOO, 'Paired OO V2 should exist').to.not.be.undefined;
      });
    });

    // ─── 5. LTAR V1 HM → V2 (in-place, no Rollup) ─────────────

    describe('LTAR V1 HM → V2', () => {
      it('converts in-place to OM V2 without Rollup', async () => {
        const tblA = await createTableWithRows('TblA', 3);
        const tblB = await createTableWithRows('TblB', 5);

        await createLtarColumn2(testContext.context, {
          title: 'TblBs',
          parentTable: tblA,
          childTable: tblB,
          type: 'hm',
        });

        const colsBefore = await getColumns(tblA.id);
        const hmCol = findCol(colsBefore, (c) => c.title === 'TblBs');
        expect(getOpts(hmCol).version).to.equal(1);

        // Link
        await ncAxiosLinkAdd({
          urlParams: { tableId: tblA.id, linkId: hmCol.id, rowId: '1' },
          body: [{ id: 1 }, { id: 2 }],
        });

        await callConvertToV2(hmCol.id);

        const colsAfter = await getColumns(tblA.id);
        const convertedCol = findCol(
          colsAfter,
          (c) =>
            c.uidt === UITypes.LinkToAnotherRecord &&
            !c.system &&
            getOpts(c)?.version === 2 &&
            getOpts(c)?.type === RelationTypes.ONE_TO_MANY,
        );
        expect(convertedCol, 'Converted OM V2 should exist').to.not.be.undefined;

        // No Rollup (LTAR doesn't need Rollup split)
        expect(colsAfter.filter((c) => c.uidt === UITypes.Rollup)).to.have.length(0);
      });
    });

    // ─── 6. LTAR V1 MM → just update version ───────────────────

    describe('LTAR V1 MM → update version', () => {
      it('updates version to V2 without Rollup', async () => {
        const tblX = await createTableWithRows('TblX', 3);
        const tblY = await createTableWithRows('TblY', 3);

        await createLtarColumn2(testContext.context, {
          title: 'TblYs',
          parentTable: tblX,
          childTable: tblY,
          type: 'mm',
        });

        const colsBefore = await getColumns(tblX.id);
        const mmCol = findCol(colsBefore, (c) => c.title === 'TblYs');

        // MM defaults to V2 already, so convert should say "already converted"
        if (getOpts(mmCol).version === 2) {
          await callConvertToV2(mmCol.id, 400);
        } else {
          await callConvertToV2(mmCol.id);
          const colsAfter = await getColumns(tblX.id);
          const converted = findCol(colsAfter, (c) => c.title === 'TblYs');
          expect(getOpts(converted).version).to.equal(2);
          expect(colsAfter.filter((c) => c.uidt === UITypes.Rollup)).to.have.length(0);
        }
      });
    });

    // ─── 7. LTAR V2 rejects conversion ─────────────────────────

    describe('LTAR V2 rejects conversion', () => {
      it('returns 400 for already-V2 LTAR column', async () => {
        const tblP = await createTableWithRows('TblP', 3);
        const tblQ = await createTableWithRows('TblQ', 3);

        await createLtarColumn2(testContext.context, {
          title: 'TblQs',
          parentTable: tblP,
          childTable: tblQ,
          type: 'mm',
        });

        const cols = await getColumns(tblP.id);
        const mmCol = findCol(cols, (c) => c.title === 'TblQs');
        expect(getOpts(mmCol).version).to.equal(2);
        expect(mmCol.uidt).to.equal(UITypes.LinkToAnotherRecord);

        // Already V2 + LTAR → reject
        await callConvertToV2(mmCol.id, 400);
      });
    });

    // ─── 8. Dependent Lookup/Rollup columns retargeted after HM→V2 conversion ──

    describe('Dependent Lookup columns retargeted after HM Links → V2', () => {
      it('retargets existing Lookup column fk_relation_column_id to newLtarCol', async () => {
        const tblA = await createTableWithRows('DepLookupParent', 3);
        const tblB = await createTableWithRows('DepLookupChild', 5);

        await createLtarColumn(testContext.context, {
          title: 'DepChildren',
          parentTable: tblA,
          childTable: tblB,
          type: 'hm',
        });

        const colsBefore = await getColumns(tblA.id);
        const hmCol = findCol(colsBefore, (c) => c.title === 'DepChildren');

        // Create a Lookup column referencing the HM Links column
        await createLookupColumn(testContext.context, {
          base: testContext.base,
          title: 'DepLookup',
          table: tblA,
          relatedTableName: tblB.table_name,
          relatedTableColumnTitle: 'DepLookupChild',
          relationColumnId: hmCol.id,
        });

        // Convert the HM Links column to V2
        await callConvertToV2(hmCol.id);

        const colsAfter = await getColumns(tblA.id);

        // hmColumn is now a Rollup
        const rollupCol = findCol(colsAfter, (c) => c.title === 'DepChildren');
        expect(rollupCol.uidt).to.equal(UITypes.Rollup);

        // New LTAR column was created
        const ltarCol = findCol(
          colsAfter,
          (c) =>
            c.uidt === UITypes.LinkToAnotherRecord &&
            !c.system &&
            c.title !== 'DepChildren',
        );
        expect(ltarCol, 'New LTAR column should exist').to.not.be.undefined;

        // Lookup column should now reference newLtarCol (not the old hmColumn)
        const lookupCol = findCol(colsAfter, (c) => c.title === 'DepLookup');
        expect(lookupCol, 'Lookup column should still exist').to.not.be.undefined;
        expect(lookupCol.uidt).to.equal(UITypes.Lookup);

        const lookupOpts = lookupCol.colOptions as any;
        expect(
          lookupOpts.fk_relation_column_id,
          'Lookup fk_relation_column_id should point to newLtarCol, not old hmColumn',
        ).to.equal(ltarCol.id);
      });
    });

    // ─── 9. Rollback: partial failure leaves no side effects ─────

    describe('Rollback on partial failure', () => {
      let tblRbParent: Model;
      let tblRbChild: Model;
      let hmColId: string;
      let fkColId: string;

      beforeEach(async () => {
        tblRbParent = await createTableWithRows('RbParent', 3);
        tblRbChild = await createTableWithRows('RbChild', 5);

        await createLtarColumn(testContext.context, {
          title: 'RbChildren',
          parentTable: tblRbParent,
          childTable: tblRbChild,
          type: 'hm',
        });

        const parentCols = await getColumns(tblRbParent.id);
        const childCols = await getColumns(tblRbChild.id);

        hmColId = findCol(parentCols, (c) => c.title === 'RbChildren').id;
        fkColId = findCol(childCols, (c) => c.uidt === UITypes.ForeignKey)?.id;
      });

      it('FK column meta entry is removed after successful conversion', async () => {
        await callConvertToV2(hmColId);

        const childColsAfter = await getColumns(tblRbChild.id);
        const fkColAfter = findCol(childColsAfter, (c) => c.uidt === UITypes.ForeignKey);
        expect(fkColAfter, 'FK column meta entry should be gone after conversion').to.be.undefined;
      });

      it('cleans up zombie junction model on failure after Model.insert', async () => {
        // Before: no junction (mm) models should exist for this base
        const tablesRsp0 = await request(testContext.context.app)
          .get(`/api/v1/db/meta/projects/${testContext.base.id}/tables`)
          .set('xc-auth', testContext.context.token)
          .expect(200);
        const mmCountBefore = (tablesRsp0.body.list ?? []).filter((t: any) => t.mm).length;
        expect(mmCountBefore).to.equal(0);

        // Stub Column.insert to throw. This fires inside createHmAndBtColumn,
        // which is called AFTER assocModel = Model.insert(...) in Phase A.2 of
        // convertLinkToV2. The catch block must call assocModel.delete(context)
        // to remove the zombie. Column.insert is NOT used by Model.delete, so
        // the rollback cleanup is unaffected by the stub.
        const stub = sinon.stub(Column, 'insert').rejects(
          new Error('Injected test failure — simulating crash after assocModel.insert'),
        );

        try {
          const rsp = await request(testContext.context.app)
            .post(`/api/v2/internal/${testContext.base.fk_workspace_id}/${testContext.base.id}`)
            .set('xc-auth', testContext.context.token)
            .query({ operation: 'convertLinkToV2', columnId: hmColId })
            .send({});

          expect(
            rsp.status,
            `Conversion should fail with injected Column.insert failure (got ${rsp.status}: ${JSON.stringify(rsp.body)})`,
          ).to.not.equal(200);
        } finally {
          stub.restore();
        }

        // FK column meta entry must still be present — Phase B (which deletes it) never ran
        const childColsAfter = await getColumns(tblRbChild.id);
        const fkColAfter = findCol(childColsAfter, (c) => c.id === fkColId);
        expect(fkColAfter, 'FK column should still exist in child table meta after rollback').to.not.be.undefined;
        expect(fkColAfter.uidt).to.equal(UITypes.ForeignKey);

        // No zombie junction model should remain in meta —
        // the catch block's assocModel.delete(context) must have cleaned it up
        const tablesRsp1 = await request(testContext.context.app)
          .get(`/api/v1/db/meta/projects/${testContext.base.id}/tables`)
          .set('xc-auth', testContext.context.token)
          .expect(200);
        const mmCountAfter = (tablesRsp1.body.list ?? []).filter((t: any) => t.mm).length;
        expect(mmCountAfter).to.equal(0, 'No zombie junction model should remain after rollback cleanup');
      });
    });
  });
});
