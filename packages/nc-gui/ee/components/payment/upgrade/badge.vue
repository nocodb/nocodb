<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import type { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'
import { OnPremFeatureToMinPlan, OnPremPlanMeta, PlanFeatureTypesToPlanTitles, PlanMeta, PlanTitles } from 'nocodb-sdk'
interface Props {
  /** Required plan to access new feature */
  planTitle?: PlanTitles
  /** Feature to check and show upgrade badge if not available */
  feature?: PlanFeatureTypes
  /**
   * If feature is not provided, then it's important to provide limitOrFeature to send this info to backend for upgrade request
   */
  limitOrFeature?: PlanFeatureTypes | PlanLimitTypes
  /** Title to show in upgrade modal */
  title?: string
  /** Content to show in upgrade modal */
  content?: string
  /** Callback will be triggered on click upgrade plan modal buttons or close modal */
  callback?: (type: 'ok' | 'cancel') => void

  disabled?: boolean
  removeClick?: boolean
  featureEnabledCallback?: () => boolean
  onClickCallback?: () => void
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** When true, renders a lock icon instead of the text badge when isEEFeatureBlocked */
  showAsLock?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'xs',
  content: '',
})

const { disabled, removeClick } = toRefs(props)

const planUpgraderClick = inject(PlanUpgraderClickHookInj, createEventHook())

const { handleUpgradePlan, getFeature, getPlanTitle, isPaymentEnabled, isOnPrem, isEEFeatureBlocked } = useEeConfig()

const isFeatureEnabled = computed(() => {
  if (ncIsFunction(props.featureEnabledCallback)) {
    return props.featureEnabledCallback()
  }

  return props.feature && getFeature(props.feature)
})

const effectivePlanTitle = computed(() => {
  if (isEEFeatureBlocked.value) {
    return PlanTitles.ENTERPRISE
  }

  if (props.planTitle) return props.planTitle

  // On-prem uses a different feature→plan mapping than cloud
  if (isOnPrem.value) {
    return OnPremFeatureToMinPlan[props.feature as PlanFeatureTypes] || PlanTitles.ENTERPRISE
  }

  return PlanFeatureTypesToPlanTitles[props.feature as PlanFeatureTypes] || PlanTitles.PLUS
})

const activeBadgeColors = computed(() => {
  const title = effectivePlanTitle.value
  const meta = (OnPremPlanMeta as any)[title] || (PlanMeta as any)[title] || PlanMeta[PlanTitles.ENTERPRISE]
  return {
    bg: meta.staticBadgeBgColor,
    text: meta.staticBadgeTextColor,
  }
})

const showUpgradeModal = (e?: MouseEvent) => {
  if (e) {
    if (removeClick.value) return

    e.stopPropagation()
  }

  if (isFeatureEnabled.value) return
  if (!isPaymentEnabled.value && !isOnPrem.value) return

  if (props.onClickCallback) {
    props.onClickCallback()
  }

  handleUpgradePlan({
    title: props.title,
    content: props.content,
    newPlanTitle: effectivePlanTitle.value,
    callback: props.callback,
    limitOrFeature: props.limitOrFeature || props.feature,
  })
}

const planUpgraderClickHandler = () => {
  showUpgradeModal()
}

planUpgraderClick.on(planUpgraderClickHandler)

onBeforeUnmount(() => {
  planUpgraderClick.off(planUpgraderClickHandler)
})
</script>

<template>
  <NcTooltip v-if="!isFeatureEnabled && showAsLock && isEEFeatureBlocked" @click="showUpgradeModal">
    <template #title>{{ $t('upgrade.enterpriseFeatureTitle') }}</template>
    <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" style="color: #0d5a5a" />
  </NcTooltip>
  <NcBadge
    v-else-if="!isFeatureEnabled && (isPaymentEnabled || isOnPrem)"
    :size="size"
    :border="false"
    class="nc-upgrade-badge cursor-pointer select-none"
    :class="[
      `nc-upgrade-${effectivePlanTitle}-badge nc-size-${size}`,
      {
        'opacity-75': disabled,
      },
    ]"
    :style="{
      'color': activeBadgeColors.text,
      '--nc-badge-bg-light': activeBadgeColors.bg,
    }"
    @click="showUpgradeModal"
  >
    <svg
      class="nc-upgrade-badge-sparkle"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" />
    </svg>
    {{ getPlanTitle(effectivePlanTitle) }}
  </NcBadge>
</template>

<style lang="scss" scoped>
.nc-upgrade-badge {
  @apply bg-[var(--nc-badge-bg-light)] font-normal transition-colors duration-200 inline-flex items-center gap-1 whitespace-nowrap;
  border-radius: 9999px;
  padding: 4px 8px;
  line-height: 1;

  &.nc-size-xs {
    @apply text-bodyDefaultSm;
  }
}

.nc-upgrade-badge-sparkle {
  width: 0.85em;
  height: 0.85em;
  flex: none;
  display: block;
}
</style>
