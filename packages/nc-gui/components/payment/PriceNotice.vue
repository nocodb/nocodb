<script lang="ts" setup>
import type { SeatPricingNotice } from 'nocodb-sdk'

defineProps<{
  notice: SeatPricingNotice | null
}>()
</script>

<template>
  <NcSpanHidden />
</template>
