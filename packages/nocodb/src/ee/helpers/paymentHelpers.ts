import { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { Workspace } from '~/models';
import Noco from '~/Noco';

const GenericLimits = {
  [PlanLimitTypes.LIMIT_FREE_WORKSPACE]: 8,
  [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 200,
  [PlanLimitTypes.LIMIT_COLUMN_PER_TABLE]: 500,
  [PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE]: 25,
  [PlanLimitTypes.LIMIT_VIEW_PER_TABLE]: 200,
  [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: 50,
  [PlanLimitTypes.LIMIT_SORT_PER_VIEW]: 10,
  [PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE]: 20,
} as const;

const GenericFeatures = {
  [PlanFeatureTypes.FEATURE_AI]: false,
  [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: false,
  [PlanFeatureTypes.FEATURE_AT_MENTION]: false,
  [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
  [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: false,
  [PlanFeatureTypes.FEATURE_CUSTOM_URL]: false,
  [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: false,
  [PlanFeatureTypes.FEATURE_EXTENSIONS]: false,
  [PlanFeatureTypes.FEATURE_FILE_MODE]: false,
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: false,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: false,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: false,
  [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: false,
  [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: false,
  [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]: false,
  [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: false,
  [PlanFeatureTypes.FEATURE_SCRIPTS]: false,
  [PlanFeatureTypes.FEATURE_SSO]: false,
  [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: false,
} as const;

async function getLimit(
  type: PlanLimitTypes,
  workspaceId?: string,
  ncMeta = Noco.ncMeta,
) {
  if (!workspaceId) {
    if (!GenericLimits[type]) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    return GenericLimits[type] || Infinity;
  }

  const workspace = await Workspace.get(workspaceId, undefined, ncMeta);

  if (!workspace) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  return (
    workspace?.payment?.plan?.meta?.[type] || GenericLimits[type] || Infinity
  );
}

async function getFeature(
  type: PlanFeatureTypes,
  workspaceId?: string,
  ncMeta = Noco.ncMeta,
) {
  if (!workspaceId) {
    if (!GenericFeatures[type]) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    return GenericFeatures[type] || false;
  }

  const workspace = await Workspace.get(workspaceId, undefined, ncMeta);

  if (!workspace) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  return (
    workspace?.payment?.plan?.meta?.[type] || GenericFeatures[type] || false
  );
}

export {
  PlanLimitTypes,
  PlanFeatureTypes,
  getLimit,
  getFeature,
  GenericLimits,
  GenericFeatures,
};
