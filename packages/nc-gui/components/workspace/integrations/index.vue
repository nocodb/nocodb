<script lang="ts" setup>
const { pageMode, IntegrationsPageMode } = useIntegrationStore()
</script>

<template>
  <div class="h-full overflow-auto w-full">
    <WorkspaceIntegrationsList />
    <WorkspaceIntegrationsNew v-if="pageMode === IntegrationsPageMode.ADD" />
    <WorkspaceIntegrationsEdit v-else-if="pageMode === IntegrationsPageMode.EDIT" />
  </div>
</template>

<style lang="scss" scoped></style>
