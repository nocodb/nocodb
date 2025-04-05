<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import { PlanFeatureTypes, PlanMeta, PlanTitles } from 'nocodb-sdk'
interface Props {
  /** Required plan to access new feature*/
  planTitle?: PlanTitles
  /** Feature to check */
  feature: PlanFeatureTypes
  /** Title to show in upgrade modal */
  title?: string
  /** Content to show in upgrade modal */
  content: string
  /** Callback will be triggered on click upgrade plan modal buttons or close modal*/
  callback?: (type: 'ok' | 'cancel') => void
}

const props = withDefaults(defineProps<Props>(), {
  planTitle: PlanTitles.TEAM,
})

const planUpgraderClick = inject(PlanUpgraderClickHookInj, createEventHook())

const { handleUpgradePlan, getFeature, getPlanTitle } = useEeConfig()

const isFeatureEnabled = computed(() => getFeature(props.feature))

const activePlanMeta = computed(() => PlanMeta[props.planTitle])

const showUpgradeModal = () => {
  if (isFeatureEnabled.value) return

  handleUpgradePlan({
    title: props.title,
    content: props.content,
    newPlanTitle: props.planTitle,
    callback: props.callback,
  })
}

planUpgraderClick.on(() => {
  showUpgradeModal()
})
</script>

<template>
  <NcBadge
    v-if="!isFeatureEnabled"
    size="sm"
    :border="false"
    @click.stop="showUpgradeModal"
    class="nc-upgrade-badge cursor-pointer select-none"
    :class="`nc-upgrade-${planTitle}-badge`"
    :style="{
      'color': activePlanMeta.primary,
      '--nc-badge-bg-light': activePlanMeta.bgLight,
      '--nc-badge-bg-dark': activePlanMeta.bgDark,
    }"
  >
    <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4 mr-1" />
    {{ getPlanTitle(planTitle) }}
  </NcBadge>
</template>

<style lang="scss" scoped>
.nc-upgrade-badge {
  @apply bg-[var(--nc-badge-bg-light)] hover:bg-[var(--nc-badge-bg-dark)] group-hover:bg-[var(--nc-badge-bg-dark)] transition-colors duration-200;
}
</style>
