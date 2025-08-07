<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import type { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'
import { PlanMeta, PlanTitles } from 'nocodb-sdk'
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
}

const props = withDefaults(defineProps<Props>(), {
  planTitle: PlanTitles.PLUS,
  size: 'xs',
  content: '',
})

const { disabled, removeClick } = toRefs(props)

const planUpgraderClick = inject(PlanUpgraderClickHookInj, createEventHook())

const { handleUpgradePlan, getFeature, getPlanTitle, isPaymentEnabled, isOnPrem } = useEeConfig()

const isFeatureEnabled = computed(() => {
  if (ncIsFunction(props.featureEnabledCallback)) {
    return props.featureEnabledCallback()
  }

  return props.feature && getFeature(props.feature)
})

const activePlanMeta = computed(() => PlanMeta[props.planTitle])

const showUpgradeModal = (e?: MouseEvent) => {
  if (e) {
    if (removeClick.value) return

    e.stopPropagation()
  }

  if (isFeatureEnabled.value || !isPaymentEnabled.value) return

  if (props.onClickCallback) {
    props.onClickCallback()
  }

  handleUpgradePlan({
    title: props.title,
    content: props.content,
    newPlanTitle: props.planTitle,
    callback: props.callback,
    limitOrFeature: props.limitOrFeature || props.feature,
  })
}

planUpgraderClick.on(() => {
  showUpgradeModal()
})
</script>

<template>
  <NcBadge
    v-if="!isFeatureEnabled && (isPaymentEnabled || isOnPrem)"
    :size="size"
    :border="false"
    class="nc-upgrade-badge cursor-pointer select-none"
    :class="`nc-upgrade-${planTitle}-badge nc-size-${size}`"
    :style="{
      'color': disabled ? activePlanMeta.accent : activePlanMeta.primary,
      '--nc-badge-bg-light': activePlanMeta.bgDark,
      '--nc-badge-bg-dark': activePlanMeta.bgDark,
    }"
    @click="showUpgradeModal"
  >
    <!-- <GeneralIcon  icon="ncArrowUpCircle" class="h-4 w-4 mr-1" /> -->
    {{ getPlanTitle(planTitle) }}
  </NcBadge>
</template>

<style lang="scss" scoped>
.nc-upgrade-badge {
  @apply bg-[var(--nc-badge-bg-light)] hover:bg-[var(--nc-badge-bg-dark)] group-hover:bg-[var(--nc-badge-bg-dark)] font-semibold transition-colors duration-200;

  &.nc-size-xs {
    @apply text-bodyDefaultSm font-normal;
  }
}
</style>
