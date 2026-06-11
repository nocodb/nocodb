<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import type { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'
import {
  getAddonMinPlan,
  OnPremFeatureToMinPlan,
  OnPremHigherPlan,
  OnPremLimitToMinPlan,
  OnPremPlanMeta,
  OnPremPlanTitles,
  PlanFeatureToAddon,
  PlanFeatureTypesToPlanTitles,
  PlanMeta,
  PlanTitles,
} from 'nocodb-sdk'
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
  /** When true, renders a lock icon instead of the text badge on on-prem deployments */
  showAsLock?: boolean
  /** When true, always renders a lock icon (any deployment) when the feature is blocked */
  iconOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'xs',
  content: '',
})

const { disabled, removeClick } = toRefs(props)

const { t } = useI18n()

const planUpgraderClick = inject(PlanUpgraderClickHookInj, createEventHook())

const {
  handleUpgradePlan,
  getFeature,
  getPlanTitle,
  isPaymentEnabled,
  isOnPrem,
  isEEFeatureBlocked,
  activePlan,
  activePlanTitle,
} = useEeConfig()

const isFeatureEnabled = computed(() => {
  if (ncIsFunction(props.featureEnabledCallback)) {
    return props.featureEnabledCallback()
  }

  return props.feature && getFeature(props.feature)
})

// Add-on-only features (SCIM, white-label) aren't unlocked by any plan tier — only by
// purchasing the separate add-on. When set, the badge advertises the add-on instead of
// a plan upgrade, while still colouring by the add-on's minimum required plan tier.
const featureAddon = computed(() => (props.feature ? PlanFeatureToAddon[props.feature] : undefined))

// Cloud plans don't exist on on-prem — translate cloud titles passed via :plan-title
// (PLUS / BUSINESS / TEAM / ENTERPRISE) to their on-prem equivalent so badges never
// show "Plus" or "Business" cloud labels in an on-prem deployment.
const cloudToOnPremTitle = (title: PlanTitles | OnPremPlanTitles | string): OnPremPlanTitles | string => {
  switch (title) {
    case PlanTitles.FREE:
      return OnPremPlanTitles.FREE
    case PlanTitles.PLUS:
    case PlanTitles.BUSINESS:
    case PlanTitles.TEAM:
      return OnPremPlanTitles.SELF_HOSTED_BUSINESS
    case PlanTitles.ENTERPRISE:
      return OnPremPlanTitles.SELF_HOSTED_ENTERPRISE
    default:
      return title
  }
}

const effectivePlanTitle = computed(() => {
  // Add-on features: tier the badge by the add-on's minimum plan on the active ladder
  // (e.g. SCIM → Scale), not the plan-feature fallback which would mislabel it as Plus.
  if (featureAddon.value) {
    const addonMin = getAddonMinPlan(featureAddon.value, isOnPrem.value || isEEFeatureBlocked.value)
    if (addonMin) return addonMin
  }

  if (props.planTitle) {
    return isOnPrem.value || isEEFeatureBlocked.value ? cloudToOnPremTitle(props.planTitle) : props.planTitle
  }

  if (isOnPrem.value || isEEFeatureBlocked.value) {
    // Licensed on-prem: the upgrade target is the next paid tier above the active plan.
    // Gate on `activePlan` being loaded — `activePlanTitle` falls back to `PlanTitles.FREE`
    // before payment data resolves, which would resolve OnPremHigherPlan['Free'] to Business
    // and flash a wrong "Business" badge on a Business-licensed instance.
    if (isOnPrem.value && !isEEFeatureBlocked.value && activePlan.value && activePlanTitle.value !== PlanTitles.FREE) {
      const next = OnPremHigherPlan[activePlanTitle.value as string]
      if (next) return next
    }

    // Unlicensed (Free): resolve from the feature/limit → min-plan maps.
    if (props.feature) {
      return OnPremFeatureToMinPlan[props.feature] || OnPremPlanTitles.SELF_HOSTED_BUSINESS
    }
    if (props.limitOrFeature) {
      const fromLimit = OnPremLimitToMinPlan[props.limitOrFeature as PlanLimitTypes]
      if (fromLimit) return fromLimit
      const fromFeature = OnPremFeatureToMinPlan[props.limitOrFeature as PlanFeatureTypes]
      if (fromFeature) return fromFeature
    }
    return OnPremPlanTitles.SELF_HOSTED_BUSINESS
  }

  return PlanFeatureTypesToPlanTitles[props.feature as PlanFeatureTypes] || PlanTitles.PLUS
})

// Tooltip text resolves through `getPlanTitle`, which handles every cloud and on-prem
// tier (Free, Plus, Business, Enterprise, Self-hosted Business → "Business",
// Self-hosted Enterprise → "Enterprise") via the `objects.paymentPlan` i18n map.
const lockTooltipText = computed(() => {
  if (featureAddon.value) {
    return t('upgrade.addonFeatureTitle', { addon: getAddonLabel(featureAddon.value) })
  }
  return t('upgrade.planFeatureTitle', { plan: getPlanTitle(effectivePlanTitle.value) })
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
  <NcTooltip v-if="!isFeatureEnabled && (iconOnly || (showAsLock && isOnPrem))" @click="showUpgradeModal">
    <template #title>{{ lockTooltipText }}</template>
    <GeneralIcon icon="ncUpgradeSparkle" class="h-3.5 w-3.5 cursor-pointer" :style="{ color: activeBadgeColors.text }" />
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
    <GeneralIcon icon="ncUpgradeSparkle" class="nc-upgrade-badge-sparkle" />
    {{ featureAddon ? t('general.addOn') : getPlanTitle(effectivePlanTitle) }}
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
