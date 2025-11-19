<script setup lang="ts">
import { SyncCategory } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const { t } = useI18n()

const { isSyncAdvancedFeaturesEnabled } = storeToRefs(useSyncStore())

const { addIntegrationConfig, availableIntegrations, syncConfigForm } = useSyncFormOrThrow()

const isOpen = ref(false)

const selectedValue = ref()

const isDisabled = computed(() => {
  // Disable for custom schema category
  if (syncConfigForm.value.sync_category === SyncCategory.CUSTOM) {
    return true
  }
  // Otherwise use feature flag
  return !isSyncAdvancedFeaturesEnabled.value
})

const tooltipText = computed(() => {
  if (syncConfigForm.value.sync_category === SyncCategory.CUSTOM) {
    return t('msg.info.multipleSourcesNotSupportedForCustomSchema')
  }
  return t('msg.info.multipleSourcesNotSupported')
})

const onSelect = (option: IntegrationItemType) => {
  addIntegrationConfig(option.sub_type)
  isOpen.value = false
}
</script>

<template>
  <div class="w-[fit-content]">
    <NcListDropdown v-model:is-open="isOpen" :disabled="isDisabled">
      <NcTooltip placement="top" :disabled="!isDisabled">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncPlus" />
          {{ $t('labels.newSource') }}
        </div>
        <template #title>
          {{ tooltipText }}
        </template>
      </NcTooltip>
      <template #overlay>
        <NcList
          :value="selectedValue"
          :list="availableIntegrations"
          option-label-key="title"
          option-value-key="sub_type"
          close-on-select
          :search-input-placeholder="$t('labels.searchIntegrations')"
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
