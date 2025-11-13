<script setup lang="ts">
import { IntegrationCategoryType } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const { syncConfigForm, addIntegrationConfig } = useSyncFormOrThrow()

const { integrationsRefreshKey } = useIntegrationStore()

const availableIntegrations = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  integrationsRefreshKey.value

  return allIntegrations.filter((i) => {
    return i.type === IntegrationCategoryType.SYNC && i.sync_category === syncConfigForm.value.sync_category
  })
})
</script>

<template>
  <div>
    <div class="text-bodyLgBold text-nc-content-gray mb-4">Select a source</div>

    <div class="flex flex-col rounded-lg border-1 border-nc-border-gray-medium">
      <div
        v-for="integration in availableIntegrations"
        :key="integration.title"
        class="border-b-1 last:border-b-0 flex items-center cursor-pointer first:rounded-t-lg last:rounded-b-lg hover:bg-nc-bg-gray-extralight gap-2 border-nc-border-gray-medium px-3 py-2"
        @click="addIntegrationConfig(integration.sub_type)"
      >
        <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" />
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

<style scoped lang="scss"></style>
