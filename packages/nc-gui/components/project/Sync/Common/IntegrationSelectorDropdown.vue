<script setup lang="ts">
import { useSyncFormOrThrow } from '../useSyncForm'

const { isSyncAdvancedFeaturesEnabled } = storeToRefs(useSyncStore())

const { addIntegrationConfig, availableIntegrations } = useSyncFormOrThrow()

const isOpen = ref(false)

const selectedValue = ref()

const onSelect = (option: IntegrationItemType) => {
  addIntegrationConfig(option.sub_type)
  isOpen.value = false
}
</script>

<template>
  <div class="w-[fit-content]">
    <NcListDropdown
      v-model:is-open="isOpen"
      tooltip-on-disabled="Multiple sources are not supported yet"
      tooltip-on-disabled-placement="top"
      :disabled="!isSyncAdvancedFeaturesEnabled"
    >
      <div class="flex items-center gap-2">
        <GeneralIcon icon="ncPlus" />
        New Source
      </div>

      <template #overlay>
        <NcList
          :value="selectedValue"
          :list="availableIntegrations"
          option-label-key="title"
          option-value-key="sub_type"
          close-on-select
          search-input-placeholder="Search integerations"
          @change="(option) => onSelect(option)"
        >
          <template #listItemContent="{ option: integration }">
            <div class="flex-1 flex items-center gap-2">
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
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>

<style scoped lang="scss"></style>
