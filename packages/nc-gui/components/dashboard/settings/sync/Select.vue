<script lang="ts" setup>
import type { SyncCategory, SyncDataType } from 'nocodb-sdk'
import { iconMap } from '#imports'

const props = defineProps<{
  value?: SyncDataType
  category?: SyncCategory
}>()

const emits = defineEmits(['update:value', 'change'])

const vModel = computed({
  get: () => props.value,
  set: (val) => emits('update:value', val),
})

const { integrationsRefreshKey } = useIntegrationStore()

const availableIntegrations = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  integrationsRefreshKey.value

  return allIntegrations.filter((i) => {
    return i.type === IntegrationCategoryType.SYNC && (!props.category || i.sync_category === props.category)
  })
})

const onChange = (value: SyncDataType) => {
  emits('change', value)
}
</script>

<template>
  <NcSelect
    :value="vModel"
    class="nc-select-shadow"
    dropdown-class-name="nc-dropdown-sync-type"
    placeholder="Select Source"
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
