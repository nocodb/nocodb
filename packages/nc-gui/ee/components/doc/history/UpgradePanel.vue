<script setup lang="ts">
import { PlanLimitTypes } from 'nocodb-sdk'

interface Props {
  // Current plan retention in days — drives the "{N} day page history" heading.
  retentionDays: number | null
  // created_at of the selected locked revision — its age picks the plan to upgrade to.
  createdAt: string | null
}

const props = defineProps<Props>()

const { retentionDays, createdAt } = toRefs(props)

const { t } = useI18n()

const { requiredPlanForRevisionAge, revisionRetentionLadder, navigateToPricing, isOnPrem } = useEeConfig()

const days = computed(() => retentionDays.value ?? 0)

// Age of the selected revision, in whole days.
const ageDays = computed(() => {
  if (!createdAt.value) return 0
  return Math.floor((Date.now() - new Date(createdAt.value).getTime()) / 86400000)
})

// Lowest plan whose retention covers this revision's age.
const requiredPlan = computed(() => requiredPlanForRevisionAge(ageDays.value))

// Retention of the plan immediately below the required one — the threshold the
// required plan unlocks past. e.g. requiredPlan=Business (90) -> prev=Plus (30)
// -> "older than 30 days". Falls back to the current plan retention if not
// resolvable (defensive — shouldn't happen for locked items in the ladder).
const previousPlanDays = computed<number>(() => {
  const ladder = revisionRetentionLadder.value
  const idx = ladder.findIndex((p) => p.title === requiredPlan.value)
  if (idx <= 0) return days.value
  return ladder[idx - 1].days
})

const description = computed(() => {
  // On-prem upgrades by entering a license key, not by upgrading a cloud plan.
  if (isOnPrem.value) {
    const count = previousPlanDays.value
    return t('labels.docHistory.lockedDescOnPrem', { count }, count)
  }
  if (requiredPlan.value) {
    const count = previousPlanDays.value
    return t('labels.docHistory.lockedDescWithPlan', { plan: requiredPlan.value, count }, count)
  }
  return t('labels.docHistory.lockedDescGeneric', { count: days.value }, days.value)
})

// Primary CTA label: "Enter license key" on on-prem, "Upgrade now" on cloud.
const ctaLabel = computed(() => (isOnPrem.value ? t('upgrade.enterLicense') : t('labels.docHistory.upgradeNow')))

function onUpgrade() {
  // On-prem: direct to the admin license page so the user can paste a key.
  if (isOnPrem.value) {
    navigateTo('/admin?tab=license')
    return
  }
  // Cloud: straight to pricing with the per-item required plan pre-activated, so
  // the highlighted CTA matches what the user clicked (avoids a confirm modal
  // naming a different "next plan" derived from the active subscription).
  navigateToPricing({
    ctaPlan: requiredPlan.value ?? undefined,
    limitOrFeature: PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS,
  })
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center h-full min-h-[400px] px-6 text-center"
    data-testid="nc-doc-history-upgrade-panel"
  >
    <div class="flex items-center justify-center w-14 h-14 rounded-full bg-nc-bg-gray-light mb-4">
      <GeneralIcon icon="ncClock" class="text-nc-content-gray-subtle w-7 h-7" />
    </div>

    <span class="text-base font-medium text-nc-content-gray">
      {{ $t('labels.docHistory.lockedTitle', { count: previousPlanDays }) }}
    </span>

    <span class="text-sm text-nc-content-gray-muted mt-2 leading-relaxed max-w-[380px]">
      {{ description }}
    </span>

    <NcButton
      v-e="['c:doc:history:upgrade']"
      type="primary"
      size="small"
      class="mt-5"
      data-testid="nc-doc-history-upgrade-btn"
      @click="onUpgrade"
    >
      {{ ctaLabel }}
    </NcButton>

    <!-- Per-plan retention reference, so the user sees what each tier keeps. -->
    <div v-if="revisionRetentionLadder.length" class="mt-8 w-full max-w-[280px]">
      <div class="text-xs font-medium text-nc-content-gray-subtle mb-2">
        {{ $t('labels.docHistory.retentionByPlanTitle') }}
      </div>
      <div
        v-for="p in revisionRetentionLadder"
        :key="p.title"
        class="flex items-center justify-between py-1 text-xs"
        :class="p.title === requiredPlan ? 'text-nc-content-brand font-medium' : 'text-nc-content-gray-muted'"
      >
        <span>{{ p.title }}</span>
        <span>{{ $t('labels.docHistory.retentionByPlanDays', { count: p.days }, p.days) }}</span>
      </div>
    </div>
  </div>
</template>
