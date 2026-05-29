import { expect } from 'chai';
import 'mocha';
import sinon from 'sinon';
import { ViewTypes } from 'nocodb-sdk';
import { PublicDataExportController } from '~/modules/jobs/jobs/data-export/public-data-export.controller';
import { PublicDatasService } from '~/services/public-datas.service';
import { View } from '~/models';

/**
 * Regression coverage for the public shared-view CSV/JSON/Excel export
 * endpoint:
 *
 *   POST /api/v2/public/export/:publicDataUuid/:exportAs
 *
 * The public **rows** endpoint sanitises `filterArrJson` / `sortArrJson`
 * against the shared view's visible-column set via
 * `PublicDatasService.sanitizeListArgsForPublicView`.  The **export**
 * endpoint goes through a different path (`PublicDataExportController`
 * → bull job → `DatasService.dataList`) which never applies that
 * sanitisation.
 *
 * That asymmetry creates a confidentiality oracle: a public-share viewer
 * can request an export with a filter on a hidden column ID, observe
 * which visible rows survive, and binary-search the hidden values.
 * See CWE-200.
 *
 * The tests below capture the payload that the controller hands to the
 * jobs service and assert that hidden-column references have been
 * stripped before they reach the export worker. They are FAILING today
 * — they will start passing once the controller (or an equivalent
 * upstream helper) applies the same sanitisation that the rows
 * endpoint already does.
 */
export function publicDataExportSanitizeTest() {
  describe('PublicDataExportController — hidden column filter sanitization', () => {
    const visibleColumnId = 'col_visible_name';
    const hiddenColumnId = 'col_hidden_salary';

    let controller: PublicDataExportController;
    let jobAddStub: sinon.SinonStub;
    let viewGetByUUIDStub: sinon.SinonStub;
    let verifyPasswordStub: sinon.SinonStub;
    let viewGetColumnsStub: sinon.SinonStub;

    beforeEach(() => {
      const fakeView: any = {
        id: 'view_test_id',
        fk_model_id: 'model_test_id',
        type: ViewTypes.GRID,
        meta: { allowCSVDownload: true },
      };

      viewGetByUUIDStub = sinon.stub(View, 'getByUUID').resolves(fakeView);
      verifyPasswordStub = sinon.stub(View, 'verifyPassword').resolves(true);

      // The sanitizer asks the view for its column visibility map. We mark
      // only the "visible" column as `show: true`; the "hidden" column is
      // present but `show: false`, mirroring how a shared grid view exposes
      // its columns in production.
      viewGetColumnsStub = sinon.stub(View, 'getColumns').resolves([
        { fk_column_id: visibleColumnId, show: true } as any,
        { fk_column_id: hiddenColumnId, show: false } as any,
      ]);

      jobAddStub = sinon.stub().resolves({ id: 'job_test_id' });

      const jobsService: any = { add: jobAddStub };
      const basesService: any = {};
      const publicDatasService = new PublicDatasService(
        null as any,
        null as any,
        null as any,
        null as any,
      );

      controller = new PublicDataExportController(
        jobsService,
        basesService,
        publicDatasService,
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    function buildContext(): any {
      return {
        workspace_id: 'ws_test',
        base_id: 'base_test',
        api_version: 'v2',
      };
    }

    function buildReq(): any {
      return {
        headers: {},
        user: { id: 'anon' },
        ncSiteUrl: 'http://localhost',
      };
    }

    it('should strip hidden-column entries from filterArrJson before enqueueing the export job (CWE-200 oracle)', async () => {
      const filterArrJson = JSON.stringify([
        {
          fk_column_id: visibleColumnId,
          comparison_op: 'eq',
          value: 'Alice',
          logical_op: 'and',
        },
        {
          // hidden — must NOT reach the export worker
          fk_column_id: hiddenColumnId,
          comparison_op: 'gt',
          value: '100',
          logical_op: 'and',
        },
      ]);

      await controller.exportModelData(
        buildContext(),
        buildReq(),
        'view_uuid_test',
        'csv',
        { filterArrJson } as any,
      );

      expect(jobAddStub.calledOnce, 'jobsService.add was not called').to.be
        .true;

      const [, jobPayload] = jobAddStub.firstCall.args;
      const enqueuedFilterArrJson = jobPayload?.options?.filterArrJson;

      expect(
        enqueuedFilterArrJson,
        'export job was enqueued without a filterArrJson — unexpected',
      ).to.be.a('string');

      const enqueuedFilters = JSON.parse(enqueuedFilterArrJson as string);

      const hiddenColRefs = enqueuedFilters.filter(
        (f: any) => f.fk_column_id === hiddenColumnId,
      );

      expect(
        hiddenColRefs,
        `hidden column "${hiddenColumnId}" leaked into the export job's filterArrJson — ` +
          `attacker can use this as a yes/no oracle on hidden values. ` +
          `Sanitize filterArrJson against view's visible-column set in PublicDataExportController.`,
      ).to.have.length(0);

      expect(enqueuedFilters).to.have.length(1);
      expect(enqueuedFilters[0].fk_column_id).to.equal(visibleColumnId);
    });

    it('should strip hidden-column entries from sortArrJson before enqueueing the export job', async () => {
      const sortArrJson = JSON.stringify([
        { fk_column_id: visibleColumnId, direction: 'asc' },
        // hidden — must NOT reach the export worker
        { fk_column_id: hiddenColumnId, direction: 'desc' },
      ]);

      await controller.exportModelData(
        buildContext(),
        buildReq(),
        'view_uuid_test',
        'csv',
        { sortArrJson } as any,
      );

      expect(jobAddStub.calledOnce, 'jobsService.add was not called').to.be
        .true;

      const [, jobPayload] = jobAddStub.firstCall.args;
      const enqueuedSortArrJson = jobPayload?.options?.sortArrJson;

      expect(enqueuedSortArrJson).to.be.a('string');

      const enqueuedSorts = JSON.parse(enqueuedSortArrJson as string);

      const hiddenColRefs = enqueuedSorts.filter(
        (s: any) => s.fk_column_id === hiddenColumnId,
      );

      expect(
        hiddenColRefs,
        `hidden column "${hiddenColumnId}" leaked into the export job's sortArrJson — ` +
          `attacker can probe hidden values by observing row order in the export.`,
      ).to.have.length(0);
    });

    it('should strip hidden-column entries from nested filter groups', async () => {
      const filterArrJson = JSON.stringify([
        {
          is_group: true,
          logical_op: 'and',
          children: [
            {
              fk_column_id: visibleColumnId,
              comparison_op: 'eq',
              value: 'Alice',
            },
            {
              fk_column_id: hiddenColumnId,
              comparison_op: 'gt',
              value: '100',
            },
          ],
        },
      ]);

      await controller.exportModelData(
        buildContext(),
        buildReq(),
        'view_uuid_test',
        'csv',
        { filterArrJson } as any,
      );

      const [, jobPayload] = jobAddStub.firstCall.args;
      const enqueuedFilters = JSON.parse(
        jobPayload?.options?.filterArrJson as string,
      );

      const flatten = (arr: any[]): any[] =>
        arr.flatMap((f) =>
          f.is_group && Array.isArray(f.children) ? flatten(f.children) : [f],
        );

      const allLeafFilters = flatten(enqueuedFilters);
      const hiddenColRefs = allLeafFilters.filter(
        (f) => f.fk_column_id === hiddenColumnId,
      );

      expect(
        hiddenColRefs,
        `hidden column "${hiddenColumnId}" leaked into a nested filter group — ` +
          `sanitisation must recurse into is_group children.`,
      ).to.have.length(0);
    });
  });
}
