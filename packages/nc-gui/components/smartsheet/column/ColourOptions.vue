<script setup lang="ts">
import { ColumnHelper, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// Set default meta values from column helper
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Colour),
  ...(vModel.value.meta || {}),
}
</script>

<template>
  <div class="w-full empty:hidden">
    <!-- Configuration options (default color, display format, swatch style/size) -->
    <!-- are currently using defaults from ColumnHelper. -->
    <!-- Uncomment and wire up UI here when customization is needed. -->
  </div>
</template>
