<script lang="ts" setup>
const { activeTable } = storeToRefs(useTablesStore())
</script>

<template>
  <div class="flex flex-col p-4" style="height: calc(100vh - (var(--topbar-height) * 2))">
    <LazyErdView :table="activeTable" :source-id="activeTable?.source_id" :show-all-columns="false" />
  </div>
</template>
