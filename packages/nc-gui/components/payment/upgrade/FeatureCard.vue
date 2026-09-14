<script lang="ts" setup>
/**
 * PaymentUpgradeFeatureCard — in-page upsell shown in place of a plan-gated
 * settings page. CE has no plans, so it renders nothing.
 */
import type { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'

interface Props {
  /** Feature — or limit — the page is gated on */
  feature: PlanFeatureTypes | PlanLimitTypes
  /** Page name, used as the card heading */
  title: string
  /** Icon shown above the heading — the page's own nav icon */
  icon?: string
  /** Where the upgrade was triggered from, for telemetry */
  triggerSource?: string
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
