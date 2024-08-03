<script lang="ts" setup>
const { pageMode, IntegrationsPageMode } = useIntegrationStore()
</script>

<template>
  <div class="h-[calc(100vh-92px)] overflow-auto w-full">
    <WorkspaceIntegrationsList v-if="pageMode === IntegrationsPageMode.LIST" />
    <WorkspaceIntegrationsNew v-else-if="pageMode === IntegrationsPageMode.ADD" />
    <WorkspaceIntegrationsEdit v-else-if="pageMode === IntegrationsPageMode.EDIT" />
  </div>
</template>

<style lang="scss" scoped></style>
