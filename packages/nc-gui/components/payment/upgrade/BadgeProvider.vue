<script lang="ts" setup>
import type { PlanFeatureTypes } from 'nocodb-sdk'

interface Props {
  /** Feature to check */
  feature: PlanFeatureTypes
}

const props = withDefaults(defineProps<Props>(), {})

const planUpgradeClickHook = createEventHook()

provide(PlanUpgraderClickHookInj, planUpgradeClickHook)

const { getFeature } = useEeConfig()

const isFeatureEnabled = computed(() => getFeature(props.feature))

const onClick = (feature: PlanFeatureTypes) => {
  if (!getFeature(feature)) {
    planUpgradeClickHook.trigger()

    // Return true if feature is not available so that we can prevent any action
    return true
  }
}
</script>

<template><slot :isFeatureEnabled="isFeatureEnabled" :click="onClick" /></template>
