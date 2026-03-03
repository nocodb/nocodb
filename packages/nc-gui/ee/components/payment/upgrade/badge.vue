<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import type { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'
import { PlanMeta, PlanTitles, PlanFeatureTypesToPlanTitles, PlanFeatureTypesToPlanTitlesEeCloud } from 'nocodb-sdk'
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

const { appInfo } = useGlobal()

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

  return (
    (appInfo.value?.isCloud
      ? PlanFeatureTypesToPlanTitles[props.feature as PlanFeatureTypes]
      : PlanFeatureTypesToPlanTitlesEeCloud[props.feature as PlanFeatureTypes]) || PlanTitles.PLUS
  )
})

const activePlanMeta = computed(() => PlanMeta[effectivePlanTitle.value])

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
    <GeneralIcon icon="ncLock" class="h-3.5 w-3.5 cursor-pointer" style="color: #c86827" />
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
      'color': activePlanMeta.badgeTextColor,
      '--nc-badge-bg-light': activePlanMeta.badgeBgColor,
    }"
    @click="showUpgradeModal"
  >
    <!-- <GeneralIcon  icon="ncArrowUpCircle" class="h-4 w-4 mr-1" /> -->
    {{ getPlanTitle(effectivePlanTitle) }}
  </NcBadge>
</template>

<style lang="scss" scoped>
.nc-upgrade-badge {
  @apply bg-[var(--nc-badge-bg-light)] font-semibold transition-colors duration-200;

  &.nc-size-xs {
    @apply text-bodyDefaultSm font-normal;
  }
}
</style>
