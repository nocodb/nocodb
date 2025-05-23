<script lang="ts" setup>
const {
  formState,
  integrationConfigs,
  selectedIntegrationIndex,
  addIntegrationConfig,
  removeIntegrationConfig,
  switchToIntegrationConfig,
  editModeModified,
  editMode,
} = useSyncStoreOrThrow()

const configs = computed(() => {
  return integrationConfigs.value.map((config, i) => {
    if (i === selectedIntegrationIndex.value) {
      return formState.value
    }

    return config
  })
})
</script>

<template>
  <div class="flex items-center mb-4 border-b border-gray-200 flex-wrap">
    <div
      v-for="(config, index) in configs"
      :key="index"
      class="px-4 py-2 cursor-pointer flex items-center gap-2"
      :class="{
        'border-b-2 border-primary text-primary': selectedIntegrationIndex === index,
        'text-gray-500': selectedIntegrationIndex !== index,
      }"
      @click="switchToIntegrationConfig(index)"
    >
      <GeneralIntegrationIcon v-if="config.sub_type" :type="config.sub_type" class="h-5 w-5" />
      <span v-else class="h-5 w-5 flex items-center justify-center bg-gray-100 rounded-full">
        {{ index + 1 }}
      </span>
      <span>
        {{ config?.title || config?.sub_type || 'New Source' }}
      </span>
      <a-button
        v-if="integrationConfigs.length > 1 && !editMode"
        type="text"
        size="small"
        class="!p-0 !min-w-0 !h-auto text-gray-400 hover:text-red-500"
        @click.stop="removeIntegrationConfig(index)"
      >
        <GeneralIcon icon="close" class="h-3 w-3" />
      </a-button>
    </div>
    <a-button v-if="!editModeModified" type="text" class="ml-2 flex items-center" @click="addIntegrationConfig">
      <GeneralIcon icon="plus" class="h-3 w-3 mr-1" />
      Add Source
    </a-button>
  </div>
</template>
