import type Stripe from 'stripe'
import { AddonDefinitions, PlanAddonTypes } from 'nocodb-sdk'
import { getI18n } from '~/plugins/a.i18n'

// Human-readable label for an add-on key. Shared by the billing add-ons list
// and the invoice table so both name add-ons identically.
export function getAddonLabel(key: PlanAddonTypes): string {
  const { t } = getI18n().global

  if (key === PlanAddonTypes.ADDON_SCIM) return t('labels.scimProvisioning')
  if (key === PlanAddonTypes.ADDON_WHITE_LABEL) return t('labels.whiteLabel.title')

  return key
}

// Branded "Plan (N seats billed annually/monthly)" label for an invoice's base-plan line.
function brandedPlanLabel(planTitle: string, planPeriod: string, seatCount: number): string {
  if (!planTitle) return ''

  const { t } = getI18n().global

  if (seatCount > 0) {
    const seats = t('objects.seatCount', { count: seatCount }, seatCount)
    return planPeriod
      ? `${planTitle} (${seats} billed ${planPeriod === 'month' ? 'monthly' : 'annually'})`
      : `${planTitle} (${seats})`
  }
  return planPeriod ? `${planTitle} (${planPeriod === 'month' ? 'Monthly' : 'Annual'})` : planTitle
}

// Build the invoice "Plan" column label. Labels each line independently so add-on /
// proration invoices are named by their catalog add-on (e.g. "SCIM Provisioning (3 seats)")
// instead of the base plan. Shared by the cloud billing invoice table and the on-prem
// license invoice table so both render identically.
//   1. Line product matches a catalog add-on → branded add-on label
//   2. Line carries `plan_title` in its own metadata → branded plan format
//   3. Fall back to Stripe's own line description
export function buildInvoicePlanLabel(
  record: Pick<Stripe.Invoice, 'parent' | 'lines'>,
  productToAddonKey: Map<string, PlanAddonTypes>,
): string {
  const { t } = getI18n().global

  const planPeriod = record?.parent?.subscription_details?.metadata?.period || ''
  // Skip zero-quantity lines — Stripe emits them for unused volume tiers / min-seat
  // floors (e.g. an on-prem "$0.00 / year" line) and they carry no billable units, so
  // labeling them would duplicate the plan row ("… (3 seats …); … (Annual)").
  const lines = (record?.lines?.data ?? []).filter((line) => (line.quantity ?? 0) > 0)

  const labels = lines
    .map((line) => {
      const addonKey = productToAddonKey.get(line?.pricing?.price_details?.product ?? '')
      if (addonKey) {
        // Only per-seat add-ons (e.g. SCIM) carry a meaningful seat count; flat add-ons
        // (white-label) are billed at quantity 1, so suffixing "(1 seat)" is misleading.
        const qty = line.quantity ?? 0
        const isPerSeat = AddonDefinitions[addonKey]?.quantityBasis === 'per_seat'
        return qty > 0 && isPerSeat
          ? `${getAddonLabel(addonKey)} (${t('objects.seatCount', { count: qty }, qty)})`
          : getAddonLabel(addonKey)
      }

      const linePlanTitle = (line?.metadata as Record<string, string> | undefined)?.plan_title
      if (linePlanTitle) return brandedPlanLabel(linePlanTitle, planPeriod, line.quantity ?? 0)
      return line.description || ''
    })
    .filter(Boolean)

  if (labels.length) return [...new Set(labels)].join('; ')

  // Fallback (no usable line data): reconstruct from subscription-level metadata.
  const planTitle = record?.parent?.subscription_details?.metadata?.plan_title || ''
  const seatCount = lines.length > 0 ? lines[lines.length - 1].quantity ?? 0 : 0
  return brandedPlanLabel(planTitle, planPeriod, seatCount)
}

export interface PlanFeatureAndLimitsItemType {
  title: string
  free: string | boolean
  team: string | boolean
  business: string | boolean
  enterprise: string | boolean
}

export interface PlanFeatureAndLimitsType {
  sectionName: string
  features: PlanFeatureAndLimitsItemType[]
}

export const planFeatureAndLimits: PlanFeatureAndLimitsType[] = [
  {
    sectionName: 'General',
    features: [
      {
        title: 'Bases',
        free: 'Unlimited',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Records',
        free: '1000',
        team: '100,000',
        business: '500,000',
        enterprise: 'Unlimited',
      },
      {
        title: 'Editors',
        free: '5',
        team: '20',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Viewers',
        free: '50',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Attachments',
        free: '1 GB',
        team: '20 GB',
        business: '100 GB',
        enterprise: '1000 GB',
      },
      {
        title: 'Record Audit',
        free: '2 weeks',
        team: '1 year',
        business: '2 years',
        enterprise: '3+ years',
      },
      {
        title: 'Base Snapshots',
        free: '5',
        team: '20',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    sectionName: 'Views',
    features: [
      {
        title: 'Grid',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Kanban',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Gallery',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Forms',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Calendar',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Locked View',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Personal View',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Forms',
    features: [
      {
        title: 'Theme',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Email Responces',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Prefilled Forms',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Custom logo & banner',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Hide NocoDB Branding',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Redirect to URL',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Input Validations',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Conditional field visibility',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Automations',
    features: [
      {
        title: 'Webhooks',
        free: '3',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Triggers/month',
        free: '100',
        team: '25,000',
        business: '100,000',
        enterprise: '500,000',
      },
      {
        title: 'Webhook Logs',
        free: '1 week',
        team: '3 months',
        business: '2 years',
        enterprise: '3+ years',
      },
      {
        title: 'Conditional Webhooks',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Custom Payload',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Advanced',
    features: [
      {
        title: 'Dynamic filters for linked records',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Aggregations',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Group Aggregations',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Extensions',
        free: '1',
        team: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        title: 'Sync',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: 'Scripts',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Share',
    features: [
      {
        title: 'Custom URL',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Password Protected',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Developer Platform',
    features: [
      {
        title: 'Rest API',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Swagger specification',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'API Snippets',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'API calls/month',
        free: '1,000',
        team: '1,000,000',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    sectionName: 'Collaboration',
    features: [
      {
        title: 'Role base permissions',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Notifications',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Record Comments',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Access Control',
    features: [
      {
        title: 'Table Permissions',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'View Permissions',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Field Permissions',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Row Permissions',
        free: false,
        team: false,
        business: true,
        enterprise: true,
      },
      {
        title: 'Custom Roles',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Integrations',
    features: [
      {
        title: 'Postgress & MySQL',
        free: '1',
        team: '1',
        business: '10',
        enterprise: 'Unlimited',
      },
      {
        title: 'Open AI/ Claude/ Ollama/ Grok',
        free: false,
        team: '1',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    sectionName: 'Admin',
    features: [
      {
        title: 'SSO',
        free: false,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Admin Panel',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: 'Workspace Audit',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: '2FA',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
      {
        title: 'API Token Permissions',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    sectionName: 'Support',
    features: [
      {
        title: 'Help center and community',
        free: true,
        team: true,
        business: true,
        enterprise: true,
      },
      {
        title: 'Email Support',
        free: false,
        team: false,
        business: true,
        enterprise: true,
      },
      {
        title: 'Priority support',
        free: false,
        team: false,
        business: false,
        enterprise: true,
      },
    ],
  },
]
