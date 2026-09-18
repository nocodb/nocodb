<script setup lang="ts">
// CE stub — Table & Field Permissions is EE-only. Mirrors the EE component's
// props + exposed surface so parent refs/bindings don't break in CE builds.
interface Props {
  tableId: string
  permissionsFieldWrapperClass?: string
  permissionsTableWrapperClass?: string
  permissionsTableToolbarClassName?: string
  hideSectionTitle?: boolean
}

defineProps<Props>()

defineExpose({ resetPermissions: () => {} })
</script>

<template>
  <NcSpanHidden />
</template>
