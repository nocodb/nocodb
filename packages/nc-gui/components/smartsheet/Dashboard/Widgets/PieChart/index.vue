<script setup lang="ts">
import type { ChartWidgetType } from 'nocodb-sdk'

interface Props {
  widget: ChartWidgetType
  isEditing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false,
})

const widgetRef = toRef(props, 'widget')
</script>

<template>This is Pie Chart Widget</template>

<style scoped lang="scss"></style>
