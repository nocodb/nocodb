import { PlanOrder, PlanTitles } from 'nocodb-sdk';
import type { OnPremPlanTitles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { getActivePlanAndSubscription } from '~/helpers/paymentHelpers';
import { isDevOrTestEnvironment } from '~/utils';

/**
 * Map of workflow node IDs to minimum required plan tier
 * Nodes not listed here are considered FREE (available to all plans)
 */
export const WorkflowNodePlanRequirements: Record<string, PlanTitles> = {
  'core.trigger.cron': PlanTitles.PLUS,
  'core.action.send_email': PlanTitles.PLUS,
  'core.flow.iterate': PlanTitles.PLUS,
  'core.flow.delay': PlanTitles.PLUS,
  'google.send_email': PlanTitles.PLUS,
  'outlook.send_email': PlanTitles.PLUS,
  'slack.send_message': PlanTitles.PLUS,
  'core.flow.wait-until': PlanTitles.PLUS,
  'ai.action.generate_text': PlanTitles.PLUS,
  'ai.action.generate_structured': PlanTitles.PLUS,
  'nocodb.run_script': PlanTitles.BUSINESS,
};

/**
 * Check if a workflow node is available for a given plan
 * @param nodeId - The workflow node ID (e.g., 'core.action.send_email')
 * @param userPlanTitle - The user's current plan title
 * @returns true if the node is available, false otherwise
 */
export function isNodeAvailableForPlan(
  nodeId: string,
  userPlanTitle: string,
): boolean {
  if (isDevOrTestEnvironment) return true;
  const requiredPlan = WorkflowNodePlanRequirements[nodeId];

  // If node not in requirements map, it's free
  if (!requiredPlan) return true;

  const userPlanOrder = PlanOrder[userPlanTitle] ?? 0;
  const requiredPlanOrder = PlanOrder[requiredPlan] ?? 0;

  return userPlanOrder >= requiredPlanOrder;
}

/**
 * Get the current plan title for a workspace
 * @param workspaceId - The workspace ID
 * @param ncMeta - NocoDB metadata instance
 * @returns The plan title (e.g., 'Free', 'Plus', 'Business', 'Enterprise')
 */
export async function getWorkspacePlanTitle(
  workspaceId: string,
  ncMeta = Noco.ncMeta,
): Promise<OnPremPlanTitles | PlanTitles> {
  const { plan } = await getActivePlanAndSubscription(
    workspaceId,
    false,
    ncMeta,
  );
  return plan?.title || PlanTitles.FREE;
}

/**
 * Get the current plan title from NcContext
 * @param context - NocoDB context
 * @returns The plan title
 */
export async function getPlanTitleFromContext(
  context: NcContext,
): Promise<PlanTitles | OnPremPlanTitles> {
  return getWorkspacePlanTitle(context.workspace_id);
}

/**
 * Get display name for a plan title
 * @param planTitle - Plan title from PlanTitles enum
 * @returns Human-readable plan name
 */
export function getPlanDisplayName(planTitle: string): string {
  const displayNames: Record<string, string> = {
    [PlanTitles.FREE]: 'Free',
    [PlanTitles.PLUS]: 'Plus',
    [PlanTitles.BUSINESS]: 'Business',
    [PlanTitles.ENTERPRISE]: 'Enterprise',
  };
  return displayNames[planTitle] || planTitle;
}
