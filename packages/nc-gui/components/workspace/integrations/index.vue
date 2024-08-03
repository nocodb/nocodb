<script lang="ts" setup>
const { pageMode, IntegrationsPageMode } = useIntegrationsPage()
</script>

<template>
  <WorkspaceIntegrationsList v-if="pageMode === IntegrationsPageMode.LIST" />
  <WorkspaceIntegrationsNew v-else-if="pageMode === IntegrationsPageMode.ADD" />
</template>

<style lang="scss" scoped></style>
