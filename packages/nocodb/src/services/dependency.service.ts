import { Injectable } from '@nestjs/common';
import { DependencyTableType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import DependencyTracker from '~/models/DependencyTracker';
import { NcError } from '~/helpers/catchError';
import { Dashboard, DateDependency, Model, Widget, Workflow } from '~/models';
import { processConcurrently } from '~/utils';

@Injectable()
export class DependencyService {
  async checkDependency(
    context: NcContext,
    params: {
      entityType: string;
      entityId: string;
    },
  ) {
    const { entityType, entityId } = params;

    const sourceType = entityType;

    if (!sourceType) {
      NcError.get(context).badRequest(`Invalid entity type: ${entityType}`);
    }

    const breakingChanges = await DependencyTracker.checkBreakingChanges(
      context,
      {
        sourceType: sourceType as any,
        sourceId: entityId,
      },
    );

    const dashboardIds = new Set<string>();
    const workflowIds = new Set<string>();
    const dateDependencyIds = new Set<string>();

    for (const dep of breakingChanges.dependents) {
      if (dep.dependent_type === DependencyTableType.Widget) {
        const widget = await Widget.get(context, dep.dependent_id);
        if (widget?.fk_dashboard_id) {
          dashboardIds.add(widget.fk_dashboard_id);
        }
      } else if (dep.dependent_type === DependencyTableType.Workflow) {
        workflowIds.add(dep.dependent_id);
      } else if (dep.dependent_type === DependencyTableType.DateDependency) {
        dateDependencyIds.add(dep.dependent_id);
      }
    }

    const [dashboards, workflows, dateDependencyTables] = await Promise.all([
      processConcurrently(Array.from(dashboardIds), (id) =>
        Dashboard.get(context, id),
      ),
      processConcurrently(Array.from(workflowIds), (id) =>
        Workflow.get(context, id),
      ),
      processConcurrently(Array.from(dateDependencyIds), async (id) => {
        const rule = await DateDependency.get(context, id);
        if (rule?.fk_model_id) {
          return Model.get(context, rule.fk_model_id);
        }
        return null;
      }),
    ]);

    const entities: Array<{
      type: DependencyTableType;
      entity: Dashboard | Workflow | Model;
    }> = [];

    for (const dashboard of dashboards.filter(Boolean)) {
      entities.push({
        type: DependencyTableType.Widget,
        entity: dashboard,
      });
    }

    for (const workflow of workflows.filter(Boolean)) {
      entities.push({
        type: DependencyTableType.Workflow,
        entity: workflow,
      });
    }

    for (const table of dateDependencyTables.filter(Boolean)) {
      entities.push({
        type: DependencyTableType.DateDependency,
        entity: table,
      });
    }

    return {
      hasBreakingChanges: breakingChanges.hasBreakingChanges,
      entities,
    };
  }
}
