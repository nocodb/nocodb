<script setup lang="ts">
import { OnPremPlanMeta, OnPremPlanTitles, PlanMeta, PlanTitles } from 'nocodb-sdk'

if (import.meta.env.PROD) {
  navigateTo('/')
}

const { isDark } = useTheme()

const cloudPlans = [PlanTitles.FREE, PlanTitles.PLUS, PlanTitles.BUSINESS, PlanTitles.ENTERPRISE] as const
const onPremPlans = [
  OnPremPlanTitles.SELF_HOSTED_STARTER,
  OnPremPlanTitles.SELF_HOSTED_SCALE,
  OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
] as const

const billingForCloud = (plan: PlanTitles): Array<[string, string]> => {
  switch (plan) {
    case PlanTitles.FREE:
      return [
        ['Number of billable users', '0 Billable Users'],
        ['Records', '226 of 1,000 records'],
        ['Storage used (GB)', '0.0 GB of 1 GB attachments'],
        ['Webhook calls (monthly)', '0 of 100 webhook calls per month'],
        ['API calls (monthly)', '0 of 1,000 API calls per month'],
      ]
    case PlanTitles.PLUS:
      return [
        ['Next invoice', '$90, Dec 12'],
        ['Number of billed users', '9 Paid Users'],
        ['Records', '11,204 of 50,000 records'],
        ['Storage used (GB)', '1.2 GB of 20 GB attachments'],
        ['Webhook calls (monthly)', '320 of 10,000 webhook calls per month'],
        ['API calls (monthly)', '812 of 10,000 API calls per month'],
      ]
    case PlanTitles.BUSINESS:
      return [
        ['Next invoice', '$375, Dec 12'],
        ['Number of billed users', '15 Paid Users'],
        ['Records', '78,430 of 250,000 records'],
        ['Storage used (GB)', '8.3 GB of 100 GB attachments'],
        ['Webhook calls (monthly)', '4,210 of 50,000 webhook calls per month'],
        ['API calls (monthly)', '9,802 of 50,000 API calls per month'],
      ]
    default:
      return [
        ['Next invoice', '—'],
        ['Number of billed users', '0 Paid Users'],
        ['Records', '226 of 5,000,000 records'],
        ['Storage used (GB)', '0.0 GB of 500 GB attachments'],
        ['Webhook calls (monthly)', '0 of Unlimited webhook calls per month'],
        ['API calls (monthly)', '0 of Unlimited API calls per month'],
      ]
  }
}

const billingForOnPrem = (plan: OnPremPlanTitles): Array<[string, string]> => {
  switch (plan) {
    case OnPremPlanTitles.SELF_HOSTED_STARTER:
      return [
        ['License', 'Self-hosted Starter'],
        ['Billed users', '10 Paid Users'],
        ['Records', 'Unlimited'],
        ['Storage used (GB)', '4.1 GB (self-hosted)'],
        ['API calls', 'Unlimited'],
      ]
    case OnPremPlanTitles.SELF_HOSTED_SCALE:
      return [
        ['License', 'Self-hosted Scale'],
        ['Billed users', '50 Paid Users'],
        ['Records', 'Unlimited'],
        ['Storage used (GB)', '72 GB (self-hosted)'],
        ['API calls', 'Unlimited'],
      ]
    default:
      return [
        ['License', 'Self-hosted Enterprise'],
        ['Billed users', 'Unlimited'],
        ['Records', 'Unlimited'],
        ['Storage used (GB)', 'Unlimited (self-hosted)'],
        ['API calls', 'Unlimited'],
      ]
  }
}

const metaForCloud = (plan: PlanTitles) => PlanMeta[plan]
const metaForOnPrem = (plan: OnPremPlanTitles) => OnPremPlanMeta[plan]

/**
 * Pull static badge tokens from the SDK. Both PlanMeta and OnPremPlanMeta now
 * expose `staticBadgeBgColor` / `staticBadgeTextColor` (pure hex, no CSS var).
 */
const staticBadge = (plan: PlanTitles | OnPremPlanTitles): { bg: string; text: string } => {
  const meta = (OnPremPlanMeta as any)[plan] || (PlanMeta as any)[plan]
  return { bg: meta.staticBadgeBgColor, text: meta.staticBadgeTextColor }
}

// Old Enterprise orange tokens — for side-by-side comparison with the
// CEO-approved teal. Kept local to the playground; doesn't touch the product.
// Table tokens swap on dark mode; badge pill stays the same (Airtable-style).
const enterpriseOrangeMeta = computed(() => {
  const base = PlanMeta[PlanTitles.ENTERPRISE]
  if (isDark.value) {
    return {
      ...base,
      color: '#1B120B',
      accent: '#5E381D',
      primary: '#E28E4C',
      bgLight: '#24170D',
      bgDark: '#160E08',
      border: '#70492C',
      chartFillColor: '#E28E4C',
      badgeBgColor: '#FEE6D6',
      badgeTextColor: '#C86827',
    }
  }
  return {
    ...base,
    color: '#FFF5EF',
    accent: '#FDCDAD',
    primary: '#C86827',
    bgLight: '#FFF5EF',
    bgDark: '#FEE6D6',
    border: '#FDCDAD',
    chartFillColor: '#C86827',
    badgeBgColor: '#FEE6D6',
    badgeTextColor: '#C86827',
  }
})

const enterpriseOrangeBadge = { bg: '#FEE6D6', text: '#C86827' }
</script>

<template>
  <div class="h-screen w-screen overflow-auto bg-nc-bg-default">
    <div class="max-w-4xl mx-auto p-8">
      <div class="mb-8">
        <a href="/playground" class="text-sm text-nc-content-brand no-underline">← Playground</a>
        <h1 class="text-4xl font-bold text-nc-content-gray-emphasis mt-2 mb-1">Plans</h1>
        <p class="text-sm text-nc-content-gray-subtle">
          Current-plan billing table and upgrade badges for both Cloud and On-Prem SKUs. Toggle the app theme to check dark mode.
        </p>
      </div>

      <!-- ========== CLOUD ========== -->
      <div class="mb-6">
        <div class="text-[11px] tracking-widest text-nc-content-gray-muted uppercase mb-1">Cloud</div>
        <div class="text-sm text-nc-content-gray-subtle">PlanMeta · Free · Plus · Business · Enterprise</div>
      </div>

      <div class="flex flex-col gap-8">
        <section v-for="plan in cloudPlans" :key="plan" class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <h2
              class="text-lg font-semibold leading-none !m-0 text-nc-content-gray-emphasis"
              :style="{ color: metaForCloud(plan).primary }"
            >
              {{ plan }}
            </h2>
            <template v-if="plan !== PlanTitles.FREE">
              <span
                class="nc-play-badge"
                :style="{
                  background: staticBadge(plan).bg,
                  color: staticBadge(plan).text,
                }"
              >
                <svg class="nc-play-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" />
                </svg>
                {{ plan }}
              </span>
              <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" :style="{ color: staticBadge(plan).text }" />
            </template>
          </div>

          <div
            class="nc-current-plan-table rounded-lg border-1"
            :style="{
              borderColor: metaForCloud(plan).border,
              background: metaForCloud(plan).bgLight,
              color: metaForCloud(plan).primary,
            }"
          >
            <PaymentPlanUsageRow v-for="row in billingForCloud(plan)" :key="row[0]" :plan-meta="metaForCloud(plan)">
              <template #label>{{ row[0] }}</template>
              <template #value>{{ row[1] }}</template>
            </PaymentPlanUsageRow>
          </div>
        </section>
      </div>

      <!-- Old orange Enterprise — for comparison only (not in product) -->
      <div class="mt-14 mb-6">
        <div class="text-[11px] tracking-widest text-nc-content-gray-muted uppercase mb-1">Legacy · Orange Enterprise</div>
        <div class="text-sm text-nc-content-gray-subtle">
          For comparison — the pre-teal Enterprise tokens. Not applied in product.
        </div>
      </div>

      <section class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold leading-none !m-0" :style="{ color: enterpriseOrangeMeta.primary }">Enterprise</h2>
          <span
            class="nc-play-badge"
            :style="{
              background: enterpriseOrangeBadge.bg,
              color: enterpriseOrangeBadge.text,
            }"
          >
            <svg class="nc-play-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" />
            </svg>
            Enterprise
          </span>
          <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" :style="{ color: enterpriseOrangeBadge.text }" />
          <span class="text-[11px] tracking-widest text-nc-content-gray-muted uppercase">Old · Orange</span>
        </div>

        <div
          class="nc-current-plan-table rounded-lg border-1"
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
      </section>

      <!-- ========== ON-PREM ========== -->
      <div class="mt-14 mb-6">
        <div class="text-[11px] tracking-widest text-nc-content-gray-muted uppercase mb-1">On-Prem</div>
        <div class="text-sm text-nc-content-gray-subtle">OnPremPlanMeta · Starter · Scale · Enterprise</div>
      </div>

      <div class="flex flex-col gap-8">
        <section v-for="plan in onPremPlans" :key="plan" class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <h2
              class="text-lg font-semibold leading-none !m-0 text-nc-content-gray-emphasis"
              :style="{ color: metaForOnPrem(plan).primary }"
            >
              {{ plan }}
            </h2>
            <span
              class="nc-play-badge"
              :style="{
                background: staticBadge(plan).bg,
                color: staticBadge(plan).text,
              }"
            >
              <svg class="nc-play-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" />
              </svg>
              {{ plan }}
            </span>
            <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" :style="{ color: staticBadge(plan).text }" />
          </div>

          <div
            class="nc-current-plan-table rounded-lg border-1"
            :style="{
              borderColor: metaForOnPrem(plan).border,
              background: metaForOnPrem(plan).bgLight,
              color: metaForOnPrem(plan).primary,
            }"
          >
            <PaymentPlanUsageRow v-for="row in billingForOnPrem(plan)" :key="row[0]" :plan-meta="metaForOnPrem(plan)">
              <template #label>{{ row[0] }}</template>
              <template #value>{{ row[1] }}</template>
            </PaymentPlanUsageRow>
          </div>
        </section>
      </div>

      <!-- Lock-only variant (showAsLock) -->
      <div class="mt-12">
        <div class="text-[11px] tracking-widest text-nc-content-gray-muted uppercase mb-3">Lock-only variant</div>
        <div class="p-5 bg-nc-bg-default rounded-xl border border-nc-border-gray-medium">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-nc-content-gray">Data Permissions</span>
              <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" style="color: #0d5a5a" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-nc-content-gray">Audit Logs</span>
              <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" style="color: #0d5a5a" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-nc-content-gray">SSO / SAML</span>
              <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" style="color: #0d5a5a" />
            </div>
          </div>
        </div>
      </div>

      <!-- Stand-alone badges strip -->
      <div class="mt-12">
        <div class="text-[11px] tracking-widest text-nc-content-gray-muted uppercase mb-3">Standalone badges — all SKUs</div>
        <div class="p-5 bg-nc-bg-default rounded-xl border border-nc-border-gray-medium">
          <div class="flex items-center gap-3 flex-wrap">
            <span
              v-for="plan in [...cloudPlans, ...onPremPlans].filter((p) => p !== PlanTitles.FREE)"
              :key="plan"
              class="nc-play-badge"
              :style="{
                background: staticBadge(plan).bg,
                color: staticBadge(plan).text,
              }"
            >
              <svg class="nc-play-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" />
              </svg>
              {{ plan }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-play-badge {
  @apply inline-flex items-center gap-1 text-[13px] font-medium rounded-full px-2 py-1 leading-none whitespace-nowrap;
  line-height: 1;
}

.nc-play-icon {
  width: 0.85em;
  height: 0.85em;
  flex: none;
  display: block;
}
</style>
