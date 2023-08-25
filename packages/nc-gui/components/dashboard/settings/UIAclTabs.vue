<script lang="ts" setup>
import { storeToRefs } from 'pinia'

const { project } = storeToRefs(useProject())
</script>

<template>
  <div v-if="!project || !project.bases"></div>
  <template v-else-if="project.bases.length === 1">
    <DashboardSettingsUIAcl :base-id="project.bases[0].id" class="mt-6" />
  </template>
  <a-tabs v-else class="w-full">
    <a-tab-pane v-for="base of project.bases" :key="base.id">
      <template #tab>
        <div class="tab-title" data-testid="proj-view-tab__all-tables">
          <div class="capitalize">{{ base.alias ?? 'Default' }}</div>
        </div>
      </template>
      <DashboardSettingsUIAcl :base-id="base.id" class="mt-6" />
    </a-tab-pane>
  </a-tabs>
</template>

<style scoped></style>
