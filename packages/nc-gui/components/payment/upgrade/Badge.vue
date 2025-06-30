<script lang="ts" setup>
/**
 * PaymentUpgradeBadge component - will only visible if feature is not available in current plan
 */
import type { PlanFeatureTypes } from 'nocodb-sdk'
import { PlanTitles } from 'nocodb-sdk'
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
  content: string
  /** Callback will be triggered on click upgrade plan modal buttons or close modal */
  callback?: (type: 'ok' | 'cancel') => void

  disabled?: boolean
  removeClick?: boolean
  featureEnabledCallback?: () => boolean
  onClickCallback?: () => void
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  planTitle: PlanTitles.PLUS,
  size: 'sm',
})
</script>

<template>
  <NcSpanHidden />
</template>
