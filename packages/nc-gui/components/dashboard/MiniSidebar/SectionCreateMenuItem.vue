<script lang="ts" setup>
/**
 * CE stub — base-level sections are EE-only. The real menu item lives at
 * ee/components/dashboard/MiniSidebar/SectionCreateMenuItem.vue and shadows
 * this in EE builds. Same props so the CE call-site typechecks.
 */
interface Props {
  isDataTab: boolean
  isBaseHomePage: boolean
  baseId?: string
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
