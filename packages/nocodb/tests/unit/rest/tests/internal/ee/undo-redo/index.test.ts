import 'mocha';
import { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk';
import init from '~test/init';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { TAB_ID, runSpec } from './harness';
import { createV3Base } from '~test/factory/base';
import { overridePlan } from '~test/utils/plan.utils';
import { columnSpecs } from './column.specs';
import { dashboardSpecs } from './dashboard.specs';
import { dateDependencySpecs } from './date-dependency.specs';
import { extensionSpecs } from './extension.specs';
import { filterSpecs } from './filter.specs';
import { hookSpecs } from './hook.specs';
import { permissionSpecs } from './permission.specs';
import { recordSpecs } from './record.specs';
import { recordLinkSpecs } from './record-link.specs';
import { recordTemplateSpecs } from './record-template.specs';
import { rlsSpecs } from './rls.specs';
import { rowColorSpecs } from './row-color.specs';
import { scriptSpecs } from './script.specs';
import { sortSpecs } from './sort.specs';
import { tableSpecs } from './table.specs';
import { viewSpecs } from './view.specs';
import { viewColumnSpecs } from './view-column.specs';
import { viewSectionSpecs } from './view-section.specs';
import { widgetSpecs } from './widget.specs';
import { workflowSpecs } from './workflow.specs';

/**
 * Data-driven undo/redo round-trip suite — see `harness.ts` for the cycle
 * `runSpec` runs. Each contract's `sandbox.id_field` is implicitly
 * verified: if redo lost the original id, `assertExists` would fail.
 */

export function undoRedoFullCoverageTests() {
  describe('Undo/Redo — full operation matrix', () => {
    let context: Context;
    let env: TestEnv;

    let restoreFeatures: (() => Promise<void>) | undefined;

    beforeEach(async () => {
      context = await init();
      context.tabId = TAB_ID;
      const workspaceId = context.fk_workspace_id!;
      const featureMock = await overridePlan({
        workspace_id: workspaceId,
        features: {
          [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: true,
          [PlanFeatureTypes.FEATURE_RLS]: true,
          [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: true,
          [PlanFeatureTypes.FEATURE_LIST_VIEW]: true,
          [PlanFeatureTypes.FEATURE_ROW_COLOUR]: true,
          [PlanFeatureTypes.FEATURE_CELL_COLOUR]: true,
          [PlanFeatureTypes.FEATURE_RECORD_TEMPLATES]: true,
          [PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS]: true,
          [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: true,
        },
        limits: {
          [PlanLimitTypes.LIMIT_RLS_POLICIES_PER_TABLE]: -1,
        },
      });
      restoreFeatures = featureMock?.restore;
      const base = await createV3Base(context, `urd_${Date.now()}`);
      env = { workspaceId, baseId: base.id };
    });

    afterEach(async () => {
      await restoreFeatures?.();
      restoreFeatures = undefined;
    });

    runGroup('table', tableSpecs, () => context, () => env);
    runGroup('column', columnSpecs, () => context, () => env);
    runGroup('view', viewSpecs, () => context, () => env);
    runGroup('view-section', viewSectionSpecs, () => context, () => env);
    runGroup('view-column', viewColumnSpecs, () => context, () => env);
    runGroup('sort', sortSpecs, () => context, () => env);
    runGroup('filter', filterSpecs, () => context, () => env);
    runGroup('hook', hookSpecs, () => context, () => env);
    runGroup('extension', extensionSpecs, () => context, () => env);
    runGroup('record-template', recordTemplateSpecs, () => context, () => env);
    runGroup('dashboard', dashboardSpecs, () => context, () => env);
    runGroup('widget', widgetSpecs, () => context, () => env);
    runGroup('script', scriptSpecs, () => context, () => env);
    runGroup('workflow', workflowSpecs, () => context, () => env);
    runGroup('permission', permissionSpecs, () => context, () => env);
    runGroup('rls', rlsSpecs, () => context, () => env);
    runGroup('row-color', rowColorSpecs, () => context, () => env);
    runGroup('record', recordSpecs, () => context, () => env);
    runGroup('record-link', recordLinkSpecs, () => context, () => env);
    runGroup('date-dependency', dateDependencySpecs, () => context, () => env);
  });
}

function runGroup(
  label: string,
  specs: RoundTripSpec<any>[],
  getCtx: () => Context,
  getEnv: () => TestEnv,
): void {
  describe(label, () => {
    for (const spec of specs) {
      const title = spec.label ?? spec.forward_op;
      it(`round-trip: ${title}`, async function () {
        this.timeout(60000);
        if (spec.skipIf?.(getCtx(), getEnv())) {
          this.skip();
          return;
        }
        await runSpec(getCtx(), getEnv(), spec);
      });
    }
  });
}
