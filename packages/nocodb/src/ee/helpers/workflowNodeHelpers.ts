import { PlanOrder, PlanTitles } from 'nocodb-sdk';
import type { OnPremPlanTitles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { getActivePlanAndSubscription } from '~/helpers/paymentHelpers';
import { isDevOrTestEnvironment, isOnPrem } from '~/utils';

/**
 * Map of workflow node IDs to minimum required plan tier
 * Nodes not listed here are considered FREE (available to all plans)
 * Supports wildcard patterns using '*' at the end (e.g., 'hubspot_crm.*')
 */
export const WorkflowNodePlanRequirements: Record<string, PlanTitles> = {
  // Triggers
  'core.trigger.cron': PlanTitles.PLUS, // Scheduled / Cron
  'core.trigger.webhook': PlanTitles.PLUS, // Incoming Webhook
  'core.trigger.email_received': PlanTitles.PLUS, // Incoming Email

  // Flow control
  'core.flow.iterate': PlanTitles.PLUS, // Iterate
  'core.flow.delay': PlanTitles.PLUS, // Delay
  'core.flow.wait-until': PlanTitles.PLUS, // Wait until

  // Actions
  'core.action.send-email': PlanTitles.PLUS, // Send email
  'core.action.http': PlanTitles.PLUS, // Http request
  'nocodb.run_script': PlanTitles.PLUS, // Run script

  // Integrations
  'google.send_email': PlanTitles.PLUS, // Gmail
  'slack.send_message': PlanTitles.PLUS, // Slack
  'outlook.send_email': PlanTitles.PLUS, // Outlook
  'twilio.action.send_sms': PlanTitles.PLUS, // Twilio SMS
  'twilio.action.call_phone': PlanTitles.PLUS, // Twilio Call
  'twilio.action.send_whatsapp': PlanTitles.PLUS, // Twilio WhatsApp

  // Google Calendar
  'google_calendar.*': PlanTitles.PLUS, // All Google Calendar nodes

  // HubSpot CRM
  'hubspot_crm.*': PlanTitles.BUSINESS, // All HubSpot CRM nodes
};

/**
 * Resolve the required plan for a workflow node ID
 * Checks exact match first, then wildcard patterns (e.g., 'hubspot_crm.*')
 * @param nodeId - The workflow node ID
 * @returns The required PlanTitles or undefined if free
 */
export function getRequiredPlanForNode(nodeId: string): PlanTitles | undefined {
  // Check for exact match first
  const exactMatch = WorkflowNodePlanRequirements[nodeId];
  if (exactMatch) return exactMatch;

  // Check for wildcard patterns
  for (const [pattern, plan] of Object.entries(WorkflowNodePlanRequirements)) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (nodeId.startsWith(prefix)) {
        return plan;
      }
    }
  }

  return undefined;
}

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
  if (isDevOrTestEnvironment || isOnPrem) return true;

  const requiredPlan = getRequiredPlanForNode(nodeId);

  // If node not in requirements map, it's free
  if (!requiredPlan) return true;

  const userPlanOrder = PlanOrder[userPlanTitle] ?? 0;
  const requiredPlanOrder = PlanOrder[requiredPlan] ?? 0;

  return userPlanOrder >= requiredPlanOrder;
}

/**
 * Get the current plan title for a workspace
 * @param workspaceOrOrgId - The workspace or organization ID
 * @param ncMeta - NocoDB metadata instance
 * @returns The plan title (e.g., 'Free', 'Plus', 'Business', 'Enterprise')
 */
export async function getActivePlanTitle(
  workspaceOrOrgId: string,
  ncMeta = Noco.ncMeta,
): Promise<OnPremPlanTitles | PlanTitles> {
  const { plan } = await getActivePlanAndSubscription(workspaceOrOrgId, ncMeta);
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
  return getActivePlanTitle(context.org_id || context.workspace_id);
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
