<script setup lang="ts">
import { OnPremPlanMeta, OnPremPlanTitles, PlanMeta, PlanTitles } from 'nocodb-sdk'
import PgDemo from '../-components/PgDemo.vue'
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'

type CloudPlanMeta = (typeof PlanMeta)[PlanTitles]

const SECTIONS = [
  { id: 'badges', title: 'Badges' },
  { id: 'cloud', title: 'Cloud billing' },
  { id: 'on-prem', title: 'On-prem billing' },
  { id: 'lock', title: 'Icon-only variant' },
  { id: 'legacy', title: 'Legacy orange Enterprise' },
]

const { isDark } = useTheme()

const cloudPlans = [PlanTitles.FREE, PlanTitles.PLUS, PlanTitles.BUSINESS, PlanTitles.SCALE, PlanTitles.ENTERPRISE] as const

const onPremPlans = [
  OnPremPlanTitles.SELF_HOSTED_BUSINESS,
  OnPremPlanTitles.SELF_HOSTED_SCALE,
  OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
] as const

// on-prem titles render without the "Self-hosted" prefix (objects.paymentPlan), so the rows are labelled
const badgeGroups = [
  { label: 'Cloud', plans: cloudPlans.filter((p) => p !== PlanTitles.FREE).map((p) => PlanMeta[p]) },
  { label: 'On-prem', plans: onPremPlans.map((p) => OnPremPlanMeta[p]) },
]

const billingForCloud = (plan: PlanTitles): Array<[string, string]> => {
  switch (plan) {
    case PlanTitles.FREE:
      return [
        ['Billable users', '0 Billable Users'],
        ['Records', '226 of 1,000 records'],
        ['Storage used', '0.0 GB of 1 GB attachments'],
        ['Webhook calls', '0 of 100 webhook calls per month'],
        ['API calls', '0 of 1,000 API calls per month'],
      ]
    case PlanTitles.PLUS:
      return [
        ['Next invoice', '$90, Dec 12'],
        ['Billed users', '9 Paid Users'],
        ['Records', '11,204 of 50,000 records'],
        ['Storage used', '1.2 GB of 20 GB attachments'],
        ['Webhook calls', '320 of 10,000 webhook calls per month'],
        ['API calls', '812 of 10,000 API calls per month'],
      ]
    case PlanTitles.BUSINESS:
      return [
        ['Next invoice', '$375, Dec 12'],
        ['Billed users', '15 Paid Users'],
        ['Records', '78,430 of 250,000 records'],
        ['Storage used', '8.3 GB of 100 GB attachments'],
        ['Webhook calls', '4,210 of 50,000 webhook calls per month'],
        ['API calls', '9,802 of 50,000 API calls per month'],
      ]
    case PlanTitles.SCALE:
      return [
        ['Next invoice', '$1,200, Dec 12'],
        ['Billed users', '40 Paid Users'],
        ['Records', '412,900 of 1,000,000 records'],
        ['Storage used', '31 GB of 250 GB attachments'],
        ['Webhook calls', '18,300 of 200,000 webhook calls per month'],
        ['API calls', '61,020 of 200,000 API calls per month'],
      ]
    default:
      return [
        ['Next invoice', '-'],
        ['Billed users', '0 Paid Users'],
        ['Records', '226 of 5,000,000 records'],
        ['Storage used', '0.0 GB of 500 GB attachments'],
        ['Webhook calls', '0 of Unlimited webhook calls per month'],
        ['API calls', '0 of Unlimited API calls per month'],
      ]
  }
}

const billingForOnPrem = (plan: OnPremPlanTitles): Array<[string, string]> => {
  switch (plan) {
    case OnPremPlanTitles.SELF_HOSTED_BUSINESS:
      return [
        ['License', 'Self-hosted Business'],
        ['Billed users', '10 Paid Users'],
        ['Records', 'Unlimited'],
        ['Storage used', '4.1 GB (self-hosted)'],
        ['API calls', 'Unlimited'],
      ]
    case OnPremPlanTitles.SELF_HOSTED_SCALE:
      return [
        ['License', 'Self-hosted Scale'],
        ['Billed users', '50 Paid Users'],
        ['Records', 'Unlimited'],
        ['Storage used', '72 GB (self-hosted)'],
        ['API calls', 'Unlimited'],
      ]
    default:
      return [
        ['License', 'Self-hosted Enterprise'],
        ['Billed users', 'Unlimited'],
        ['Records', 'Unlimited'],
        ['Storage used', 'Unlimited (self-hosted)'],
        ['API calls', 'Unlimited'],
      ]
  }
}

// Pre-teal Enterprise tokens, kept here for side-by-side comparison only.
const enterpriseOrangeMeta = computed<CloudPlanMeta>(() => {
  const base = PlanMeta[PlanTitles.ENTERPRISE]
  const tokens = isDark.value
    ? {
        color: '#1B120B',
        accent: '#5E381D',
        primary: '#E28E4C',
        bgLight: '#24170D',
        bgDark: '#160E08',
        border: '#70492C',
        chartFillColor: '#E28E4C',
      }
    : {
        color: '#FFF5EF',
        accent: '#FDCDAD',
        primary: '#C86827',
        bgLight: '#FFF5EF',
        bgDark: '#FEE6D6',
        border: '#FDCDAD',
        chartFillColor: '#C86827',
      }
  return {
    ...base,
    ...tokens,
    badgeBgColor: '#FEE6D6',
    badgeTextColor: '#C86827',
    staticBadgeBgColor: '#FEE6D6',
    staticBadgeTextColor: '#C86827',
  }
})

const LOCKED_FEATURES = ['Data permissions', 'Audit logs', 'SSO / SAML']
</script>

<template>
  <PgPage
    title="Plans"
    description="Upgrade badges and the current-plan billing table for every Cloud and On-prem SKU. Switch the theme in the top bar to check dark mode."
    :sections="SECTIONS"
  >
    <PgSection
      id="badges"
      title="Badges"
      source="staticBadgeBgColor · staticBadgeTextColor"
      description="Static badge colours are plain hex so the pill looks the same in light and dark mode."
    >
      <PgDemo label="All paid SKUs" hint="badge, then the icon-only form">
        <div class="flex flex-col gap-3">
          <div v-for="group in badgeGroups" :key="group.label" class="flex items-center gap-3 flex-wrap">
            <span class="w-16 flex-none text-captionSm text-nc-content-gray-muted">{{ group.label }}</span>
            <div v-for="meta in group.plans" :key="meta.title" class="flex items-center gap-1.5">
              <span
                class="nc-play-badge text-caption"
                :style="{ background: meta.staticBadgeBgColor, color: meta.staticBadgeTextColor }"
              >
                <GeneralIcon icon="ncUpgradeSparkle" class="nc-play-icon" />
                {{ $t(`objects.paymentPlan.${meta.title}`) }}
              </span>
              <GeneralIcon icon="ncUpgradeSparkle" class="h-3.5 w-3.5" :style="{ color: meta.staticBadgeTextColor }" />
            </div>
          </div>
        </div>
      </PgDemo>
    </PgSection>

    <PgSection
      id="cloud"
      title="Cloud billing"
      source="PlanMeta · PaymentPlanUsageRow"
      description="The current-plan table from Billing, tinted with each plan's bgLight / border / primary tokens."
    >
      <PgDemo v-for="plan in cloudPlans" :key="plan" :label="plan">
        <template #actions>
          <span
            v-if="plan !== PlanTitles.FREE"
            class="nc-play-badge text-caption"
            :style="{ background: PlanMeta[plan].staticBadgeBgColor, color: PlanMeta[plan].staticBadgeTextColor }"
          >
            <GeneralIcon icon="ncUpgradeSparkle" class="nc-play-icon" />
            {{ $t(`objects.paymentPlan.${plan}`) }}
          </span>
        </template>
        <div
          class="rounded-lg border-1 overflow-hidden"
          :style="{
            borderColor: PlanMeta[plan].border,
            background: PlanMeta[plan].bgLight,
            color: PlanMeta[plan].primary,
          }"
        >
          <PaymentPlanUsageRow v-for="row in billingForCloud(plan)" :key="row[0]" :plan-meta="PlanMeta[plan]">
            <template #label>{{ row[0] }}</template>
            <template #value>{{ row[1] }}</template>
          </PaymentPlanUsageRow>
        </div>
      </PgDemo>
    </PgSection>

    <PgSection id="on-prem" title="On-prem billing" source="OnPremPlanMeta" description="Self-hosted licence tiers.">
      <PgDemo v-for="plan in onPremPlans" :key="plan" :label="plan">
        <template #actions>
          <span
            class="nc-play-badge text-caption"
            :style="{
              background: OnPremPlanMeta[plan].staticBadgeBgColor,
              color: OnPremPlanMeta[plan].staticBadgeTextColor,
            }"
          >
            <GeneralIcon icon="ncUpgradeSparkle" class="nc-play-icon" />
            {{ $t(`objects.paymentPlan.${plan}`) }}
          </span>
        </template>
        <div
          class="rounded-lg border-1 overflow-hidden"
          :style="{
            borderColor: OnPremPlanMeta[plan].border,
            background: OnPremPlanMeta[plan].bgLight,
            color: OnPremPlanMeta[plan].primary,
          }"
        >
          <PaymentPlanUsageRow v-for="row in billingForOnPrem(plan)" :key="row[0]" :plan-meta="OnPremPlanMeta[plan]">
            <template #label>{{ row[0] }}</template>
            <template #value>{{ row[1] }}</template>
          </PaymentPlanUsageRow>
        </div>
      </PgDemo>
    </PgSection>

    <PgSection
      id="lock"
      title="Icon-only variant"
      source="iconOnly · showAsLock"
      description="Used in dense lists where a full badge would be too loud."
    >
      <PgDemo label="Settings list">
        <div class="flex flex-col max-w-md">
          <div
            v-for="feature in LOCKED_FEATURES"
            :key="feature"
            class="flex items-center gap-1.5 h-9 border-b-1 border-nc-border-gray-light last:border-b-0"
          >
            <span class="text-caption text-nc-content-gray">{{ feature }}</span>
            <GeneralIcon
              icon="ncUpgradeSparkle"
              class="h-3.5 w-3.5"
              :style="{ color: PlanMeta[PlanTitles.ENTERPRISE].staticBadgeTextColor }"
            />
          </div>
        </div>
      </PgDemo>
    </PgSection>

    <PgSection
      id="legacy"
      title="Legacy orange Enterprise"
      description="The pre-teal Enterprise tokens, for comparison only. Not applied in the product."
    >
      <PgDemo label="Enterprise (orange)">
        <template #actions>
          <span
            class="nc-play-badge text-caption"
            :style="{
              background: enterpriseOrangeMeta.staticBadgeBgColor,
              color: enterpriseOrangeMeta.staticBadgeTextColor,
            }"
          >
            <GeneralIcon icon="ncUpgradeSparkle" class="nc-play-icon" />
            {{ $t('objects.paymentPlan.Enterprise') }}
          </span>
        </template>
        <div
          class="rounded-lg border-1 overflow-hidden"
          :style="{
            borderColor: enterpriseOrangeMeta.border,
            background: enterpriseOrangeMeta.bgLight,
            color: enterpriseOrangeMeta.primary,
          }"
        >
          <PaymentPlanUsageRow
            v-for="row in billingForCloud(PlanTitles.ENTERPRISE)"
            :key="row[0]"
            :plan-meta="enterpriseOrangeMeta"
          >
            <template #label>{{ row[0] }}</template>
            <template #value>{{ row[1] }}</template>
          </PaymentPlanUsageRow>
        </div>
      </PgDemo>
    </PgSection>
  </PgPage>
</template>

<style scoped lang="scss">
.nc-play-badge {
  @apply inline-flex items-center gap-1 rounded-full px-2 py-1 leading-none whitespace-nowrap;
}

.nc-play-icon {
  width: 0.85em;
  height: 0.85em;
  flex: none;
  display: block;
}
</style>
