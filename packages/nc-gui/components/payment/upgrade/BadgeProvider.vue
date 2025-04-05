<script lang="ts" setup>
import type { PlanFeatureTypes } from 'nocodb-sdk'

const planUpgradeClickHook = createEventHook()

provide(PlanUpgraderClickHookInj, planUpgradeClickHook)

const { getFeature } = useEeConfig()

const onClick = (feature: PlanFeatureTypes) => {
  if (!getFeature(feature)) {
    planUpgradeClickHook.trigger()

    // Return true if feature is not available so that we can prevent any action
    return true
  }
}
</script>

<template><slot :click="onClick" /></template>
