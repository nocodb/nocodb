<script lang="ts" setup>
// CE stub — Record-Level Security is EE-only. Mirrors the EE component's props
// + exposed surface so parent refs/bindings don't break in CE builds.
interface Props {
  tableId: string
  base?: any
  tableName?: string
  inShell?: boolean
}

defineProps<Props>()

defineExpose({ addPolicy: () => {}, addDefaultPolicy: () => {}, hasDefaultPolicy: false })
</script>

<template>
  <NcSpanHidden />
</template>
