<script setup lang="ts">
import { useSyncFormOrThrow } from '../useSyncForm'

const { integrationConfigs } = useSyncFormOrThrow()
</script>

<template>
  <div>
    <div class="text-bodyLgBold text-nc-content-gray mb-4">Configure Sources</div>

    <div v-for="(config, index) in integrationConfigs" :key="String(config.id)">
      <ProjectSyncCommonIntegrationAccordion :key="config.sub_type" :index="index" />
      <NcDivider class="!my-6" />
    </div>

    <ProjectSyncCommonIntegrationSelectorDropdown />
  </div>
</template>
