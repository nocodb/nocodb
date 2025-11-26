import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import DependencyTracker, {
  DependencyTableType,
} from '~/models/DependencyTracker';
import { NcError } from '~/helpers/catchError';
import { Dashboard, Widget, Workflow } from '~/models';
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
      sourceType as any,
      entityId,
    );

    const detailedDeps = await DependencyTracker.getDependentsBySource(
      context,
      sourceType as any,
      entityId,
      undefined,
    );

    const dependencies: any = {
      hasBreakingChanges: breakingChanges.hasBreakingChanges,
      dashboards: [],
      workflows: [],
    };

    const dashboardIds = new Set<string>();
    const workflowIds = new Set<string>();

    for (const dep of detailedDeps) {
      if (dep.dependent_type === DependencyTableType.Widget) {
        const widget = await Widget.get(context, dep.dependent_id);
        if (widget?.fk_dashboard_id) {
          dashboardIds.add(widget.fk_dashboard_id);
        }
      } else if (dep.dependent_type === DependencyTableType.Workflow) {
        workflowIds.add(dep.dependent_id);
      }
    }

    const [dashboards, workflows] = await Promise.all([
      processConcurrently(Array.from(dashboardIds), (id) =>
        Dashboard.get(context, id),
      ),
      processConcurrently(Array.from(workflowIds), (id) =>
        Workflow.get(context, id),
      ),
    ]);

    dependencies.dashboards = dashboards.filter(Boolean);
    dependencies.workflows = workflows.filter(Boolean);

    return dependencies;
  }
}
