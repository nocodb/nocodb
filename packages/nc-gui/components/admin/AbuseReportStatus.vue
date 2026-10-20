<script lang="ts" setup>
import { AbuseReportStatus } from 'nocodb-sdk'

const props = defineProps<{
  status: AbuseReportStatus
}>()

const color = computed(() => {
  switch (props.status) {
    case AbuseReportStatus.OPEN:
      return 'orange'
    case AbuseReportStatus.RESOLVED:
      return 'green'
    default:
      return 'gray'
  }
})
</script>

<template>
  <NcBadge :color="color" :border="false" class="!h-5 text-xs font-semibold px-2 w-fit">
    {{ $t(`labels.abuseReport.statuses.${status}`) }}
  </NcBadge>
</template>
