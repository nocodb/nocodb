<script lang="ts" setup>
import { storeToRefs } from 'pinia'

const { base } = storeToRefs(useBase())
</script>

<template>
  <div v-if="!base || !base.sources"></div>
  <template v-else-if="base.sources.length === 1">
    <DashboardSettingsUIAcl :source-id="base.sources[0].id" class="mt-6" />
  </template>
  <a-tabs v-else class="w-full">
    <a-tab-pane v-for="source of base.sources" :key="source.id">
      <template #tab>
        <div class="tab-title" data-testid="proj-view-tab__all-tables">
          <div class="capitalize">{{ source.alias ?? 'Default' }}</div>
        </div>
      </template>
      <DashboardSettingsUIAcl :source-id="source.id" class="mt-6" />
    </a-tab-pane>
  </a-tabs>
</template>

<style scoped></style>
