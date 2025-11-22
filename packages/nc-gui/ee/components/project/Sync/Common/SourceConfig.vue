<script setup lang="ts">
import { useSyncFormOrThrow } from '../useSyncForm'

const { integrationConfigs } = useSyncFormOrThrow()
</script>

<template>
  <div class="h-full">
    <div class="text-bodyLgBold text-nc-content-gray mb-4">Configure Sources</div>

    <div v-for="(_config, index) in integrationConfigs" :key="index">
      <ProjectSyncCommonIntegrationAccordion :index="index" />
      <NcDivider class="!my-6" />
    </div>

    <ProjectSyncCommonIntegrationSelectorDropdown />
  </div>
</template>
