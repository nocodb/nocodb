<script lang="ts" setup>
import type { SyncDataType } from 'nocodb-sdk'
import { iconMap } from '#imports'

const props = defineProps<{
  modelValue?: SyncDataType
}>()

const emits = defineEmits(['update:modelValue', 'change'])

const vModel = useVModel(props, 'modelValue', emits)

const { integrationsRefreshKey } = useIntegrationStore()

const availableIntegrations = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  integrationsRefreshKey.value

  return allIntegrations.filter((i) => {
    return i.type === IntegrationCategoryType.SYNC
  })
})

const onChange = (value: SyncDataType) => {
  emits('change', value)
}
</script>

<template>
  <NcSelect
    v-model:value="vModel"
    class="nc-select-shadow"
    dropdown-class-name="nc-dropdown-sync-type"
    placeholder="Select Source"
    show-search
    dropdown-match-select-width
    @change="onChange"
  >
    <a-select-option v-for="integration in availableIntegrations" :key="`${integration.sub_type}`" :value="integration.sub_type">
      <div class="w-full flex gap-2 items-center">
        <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" />
        <NcTooltip class="flex-1 truncate">
          <template #title>
            {{ integration.title }}
          </template>
          {{ integration.title }}
        </NcTooltip>
        <component
          :is="iconMap.check"
          v-if="vModel === integration.sub_type"
          id="nc-selected-item-icon"
          class="text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NcSelect>
</template>

<style lang="scss" scoped>
.nc-dropdown-sync-type {
  @apply !z-1000;
}
</style>
