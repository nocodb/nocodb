<script lang="ts" setup>
const { pageMode, IntegrationsPageMode } = useIntegrationStore()
</script>

<template>
  <div class="h-full overflow-auto w-full">
    <WorkspaceIntegrationsList />
  </div>
</template>

<style lang="scss" scoped></style>
