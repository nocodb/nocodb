<script setup lang="ts">
import { useSyncFormOrThrow } from '../useSyncForm'

const { integrationConfigs } = useSyncFormOrThrow()
</script>

<template>
  <template v-if="!integrationConfigs.length">
    <ProjectSyncCommonEmptySourceSelector />
  </template>
  <template v-else>
    <ProjectSyncCommonSourceConfig />
  </template>
</template>
