<script lang="ts" setup>
interface Props {
  isDataTab: boolean
  isBaseHomePage: boolean
  baseId?: string
  isWorkflowsTab?: boolean
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
