<script lang="ts" setup>
import type { DashboardType } from 'nocodb-sdk'

const props = defineProps<{
  dashboard: DashboardType
}>()
const meta = computed(() => props.dashboard.meta as Record<string, any> | undefined)
const icon = computed<string>(() => meta.value?.icon)
</script>

<template>
  <LazyGeneralEmojiPicker v-if="icon" :data-testid="`nc-emoji-${icon}`" class="text-lg" size="small" :emoji="icon" readonly />
  <component :is="iconMap.dashboards" v-else class="w-4 mx-0.75" />
</template>
