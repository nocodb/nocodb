import { WorkspacePlan } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import Workspace from '~/models/Workspace';

enum PlanLimitTypes {
  // PER USER
  FREE_WORKSPACE_LIMIT = 'FREE_WORKSPACE_LIMIT',

  // PER WORKSPACE
  WORKSPACE_ROW_LIMIT = 'WORKSPACE_ROW_LIMIT',
  BASE_LIMIT = 'BASE_LIMIT',

  // PER BASE
  SOURCE_LIMIT = 'SOURCE_LIMIT',

  // PER BASE
  TABLE_LIMIT = 'TABLE_LIMIT',

  // PER TABLE
  COLUMN_LIMIT = 'COLUMN_LIMIT',
  TABLE_ROW_LIMIT = 'TABLE_ROW_LIMIT',
  WEBHOOK_LIMIT = 'WEBHOOK_LIMIT',
  VIEW_LIMIT = 'VIEW_LIMIT',

  // PER VIEW
  FILTER_LIMIT = 'FILTER_LIMIT',
  SORT_LIMIT = 'SORT_LIMIT',
}

const PlanLimits = {
  generic: {
    [PlanLimitTypes.FREE_WORKSPACE_LIMIT]: 5,
  },
  [WorkspacePlan.FREE]: {
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 10000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 1,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 150,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 1000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 5,
    [PlanLimitTypes.VIEW_LIMIT]: 50,
    [PlanLimitTypes.FILTER_LIMIT]: 4,
    [PlanLimitTypes.SORT_LIMIT]: 6,
  },
  [WorkspacePlan.STANDARD]: {
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 5 * 10000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 1,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 150,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 10000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 5,
    [PlanLimitTypes.VIEW_LIMIT]: 50,
    [PlanLimitTypes.FILTER_LIMIT]: 4,
    [PlanLimitTypes.SORT_LIMIT]: 6,
  },
  [WorkspacePlan.BUSINESS]: {
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 100 * 10000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 1,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 150,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 25 * 10000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 5,
    [PlanLimitTypes.VIEW_LIMIT]: 50,
    [PlanLimitTypes.FILTER_LIMIT]: 4,
    [PlanLimitTypes.SORT_LIMIT]: 6,
  },
  [WorkspacePlan.BUSINESS_PRO]: {
    [PlanLimitTypes.WORKSPACE_ROW_LIMIT]: 1000 * 10000,
    [PlanLimitTypes.BASE_LIMIT]: 20,
    [PlanLimitTypes.SOURCE_LIMIT]: 1,
    [PlanLimitTypes.TABLE_LIMIT]: 100,
    [PlanLimitTypes.COLUMN_LIMIT]: 150,
    [PlanLimitTypes.TABLE_ROW_LIMIT]: 100 * 10000,
    [PlanLimitTypes.WEBHOOK_LIMIT]: 5,
    [PlanLimitTypes.VIEW_LIMIT]: 50,
    [PlanLimitTypes.FILTER_LIMIT]: 4,
    [PlanLimitTypes.SORT_LIMIT]: 6,
  },
};

function getLimitsForPlan(plan: WorkspacePlan) {
  return PlanLimits[plan];
}

async function getLimit(type: PlanLimitTypes, workspaceId?: string) {
  if (!workspaceId) {
    if (!PlanLimits.generic[type]) {
      return NcError.forbidden('You are not allowed to perform this action');
    }

    return PlanLimits.generic[type];
  }

  const workspace = await Workspace.get(workspaceId);

  if (!workspace) {
    return NcError.forbidden('You are not allowed to perform this action');
  }

  const plan = workspace.plan;

  return PlanLimits[plan][type];
}

export { PlanLimitTypes, getLimit, getLimitsForPlan };
