<script lang="ts" setup>
import type { PlanFeatureTypes } from 'nocodb-sdk'

interface Props {
  /** Feature to check */
  feature: PlanFeatureTypes
}

const props = withDefaults(defineProps<Props>(), {})

const planUpgradeClickHook = createEventHook()

provide(PlanUpgraderClickHookInj, planUpgradeClickHook)

const { getFeature, isPaymentEnabled } = useEeConfig()

const isFeatureEnabled = computed(() => getFeature(props.feature))

const onClick = (feature: PlanFeatureTypes, successCallback?: (...arg: any[]) => any | Promise<any>, bypass: boolean = false) => {
  if (isEeUI && !getFeature(feature) && isPaymentEnabled.value && !bypass) {
    planUpgradeClickHook.trigger()

    // Return true if feature is not available so that we can prevent any action
    return true
  } else {
    successCallback?.()
  }
}
</script>

<template><slot :is-feature-enabled="isFeatureEnabled" :click="onClick" /></template>
