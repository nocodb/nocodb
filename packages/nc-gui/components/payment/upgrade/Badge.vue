<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import type { PlanFeatureTypes } from 'nocodb-sdk'
import { PlanTitles } from 'nocodb-sdk'
interface Props {
  /** Required plan to access new feature */
  planTitle?: PlanTitles
  /** Feature to check */
  feature: PlanFeatureTypes
  /** Title to show in upgrade modal */
  title: string
  /** Content to show in upgrade modal */
  content: string
  /** Callback will be triggered on click upgrade plan modal buttons or close modal */
  callback?: (type: 'ok' | 'cancel') => void
}

withDefaults(defineProps<Props>(), {
  planTitle: PlanTitles.TEAM,
})
</script>

<template>
  <span class="hidden"></span>
</template>

<style lang="scss" scoped></style>
