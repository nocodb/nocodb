<script lang="ts" setup>
// CE stub — Record-Level Security is an EE-only feature. The full implementation
// lives in ee/components/rls/PolicyList.vue. This stub keeps the component
// resolvable (and props validated) in CE builds, where it never renders.
interface Props {
  tableId: string
  base?: any
  tableName?: string
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
