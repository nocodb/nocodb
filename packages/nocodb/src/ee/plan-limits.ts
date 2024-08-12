import { PlanLimitTypes, WorkspacePlan } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import Workspace from '~/models/Workspace';

const PlanLimits = {
  generic: {
    [PlanLimitTypes.FREE_WORKSPACE_LIMIT]: 8,
  },
  [WorkspacePlan.FREE]: {
    [PlanLimitTypes.WORKSPACE_USER_LIMIT]: 20,
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 500 * 1000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 10,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 500,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 500 * 1000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 10,
    [PlanLimitTypes.VIEW_LIMIT]: 150,
    [PlanLimitTypes.FILTER_LIMIT]: 30,
    [PlanLimitTypes.SORT_LIMIT]: 10,
  },
  [WorkspacePlan.TEAM]: {
    [PlanLimitTypes.WORKSPACE_USER_LIMIT]: 20,
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 500 * 1000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 10,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 500,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 500 * 1000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 10,
    [PlanLimitTypes.VIEW_LIMIT]: 150,
    [PlanLimitTypes.FILTER_LIMIT]: 30,
    [PlanLimitTypes.SORT_LIMIT]: 10,
  },
  [WorkspacePlan.BUSINESS]: {
    [PlanLimitTypes.WORKSPACE_USER_LIMIT]: 30,
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 500 * 1000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 10,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 500,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 500 * 1000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 10,
    [PlanLimitTypes.VIEW_LIMIT]: 150,
    [PlanLimitTypes.FILTER_LIMIT]: 30,
    [PlanLimitTypes.SORT_LIMIT]: 10,
  },
};

function getLimitsForPlan(plan: WorkspacePlan) {
  return {
    ...PlanLimits.generic,
    ...PlanLimits[plan],
  };
}

async function getLimit(type: PlanLimitTypes, workspaceId?: string) {
  if (!workspaceId) {
    if (!PlanLimits.generic[type]) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    return PlanLimits.generic[type] || Infinity;
  }

  const workspace = await Workspace.get(workspaceId);

  if (!workspace) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  const plan = workspace.plan;

  return PlanLimits[plan][type] || Infinity;
}

export { PlanLimitTypes, getLimit, getLimitsForPlan };
