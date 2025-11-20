<script setup lang="ts">
import { useSyncFormOrThrow } from '../useSyncForm'

const { addIntegrationConfig, availableIntegrations } = useSyncFormOrThrow()
</script>

<template>
  <div>
    <div class="text-bodyLgBold text-nc-content-gray mb-4">
      {{ $t('labels.selectASource') }}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div
        v-for="integration of availableIntegrations"
        :key="integration.title"
        class="border-1 border-nc-border-gray-medium rounded-lg flex items-center cursor-pointer transition-all hover:(bg-nc-bg-gray-extralight shadow-sm) gap-3 px-3 py-2"
        @click="addIntegrationConfig(integration.sub_type)"
      >
        <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" size="lg" />
        <NcTooltip show-on-truncate-only class="flex-1 truncate">
          <template #title>
            {{ integration.title }}
          </template>
          <div class="text-captionBold text-nc-content-gray">
            {{ integration.title }}
          </div>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>
