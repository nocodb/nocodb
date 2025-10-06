<script setup lang="ts">
import { validateConfigValues } from 'nocodb-sdk'
import type { ScriptConfig, ScriptConfigItemField, ScriptConfigItemView } from '~/lib/types'

interface Props {
  config: ScriptConfig
  modelValue: Record<string, any>
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'change'])

const { updateScript, isSettingsOpen, isValidConfig } = useScriptStoreOrThrow()

const configValue = useVModel(props, 'modelValue', emit)

const isLoading = ref(false)

const hasInput = computed(() => props.config?.items?.length > 0)

const getValue = (key: string): string => configValue.value[key]?.value || ''

const canShowFieldOrView = (item: ScriptConfigItemField | ScriptConfigItemView): boolean => {
  if (!item?.parentTable) return true
  return !getValue(item.parentTable)
}

const isConfigValid = computed(() => {
  const res = validateConfigValues(props.config, configValue.value)
  return res.length === 0
})

const handleTableChange = (key: string, value: string | null) => {
  configValue.value[key] = value ? { type: 'table', value } : undefined

  // Clear dependent fields/views when table changes
  ;(props.config?.items ?? []).forEach((item) => {
    if (item.type === 'field' || item.type === 'view') {
      if (item.parentTable === key) {
        configValue.value[item.key] = undefined
      }
    }
  })
}

const handleFieldOrViewChange = (item: ScriptConfigItemField | ScriptConfigItemView, value: string | null) => {
  if (!value) return
  if (value && item.parentTable) {
    const tableId = configValue.value[item.parentTable]?.value
    if (tableId) {
      configValue.value[item.key] = {
        type: item.type,
        value,
        tableId,
      }
    }
  } else {
    configValue.value[item.key] = value ? { type: item.type, value } : undefined
  }
}

const triggerUpdate = async () => {
  try {
    isLoading.value = true
    await updateScript({
      config: configValue.value,
    })
    message.toast('Script settings saved!')
    isSettingsOpen.value = false
  } catch (error) {
    message.error(await extractSdkResponseErrorMsgv2(error as any))
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  ;(props.config?.items ?? []).forEach((item) => {
    if (item.type === 'table') {
      configValue.value[item.key] = configValue.value[item.key] || { type: item.type, value: '' }
    } else if (item.type === 'field' || item.type === 'view') {
      const parentTableValue = configValue.value[item.parentTable]?.value
      configValue.value[item.key] = configValue.value[item.key] || {
        type: item.type,
        value: '',
        tableId: parentTableValue || '',
      }
    }
  })
})
</script>

<template>
  <div class="p-6 overflow-y-auto bg-nc-bg-gray-extralight config-wrapper nc-scrollbar-md" data-testid="nc-script-config-panel">
    <div class="flex mx-auto flex-col max-w-130 gap-6">
      <NcAlert v-if="!isValidConfig" type="warning" class="bg-nc-bg-default" data-testid="nc-script-config-warning">
        <template #message> Setup script settings to run </template>
        <template #description> You cannot run this script without setting up the script settings first. </template>
      </NcAlert>

      <div>
        <div class="text-subHeading2 text-nc-content-gray-emphasis" data-testid="nc-script-config-title">
          {{ config?.title || 'Script Settings' }}
        </div>
        <div v-if="config?.description" class="text-nc-content-gray-subtle2 whitespace-pre-wrap text-body mt-2" data-testid="nc-script-config-description">
          {{ config?.description }}
        </div>
      </div>

      <div v-for="item in config?.items" :key="item.key" :data-testid="`nc-script-config-item-${item.key}`">
        <template v-if="item.type === 'table'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <NcListTableSelector
              disable-label
              :value="getValue(item.key)"
              :data-testid="`nc-script-config-table-${item.key}`"
              @update:value="(value) => handleTableChange(item.key, value)"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'view'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <NcListViewSelector
              disable-label
              :value="getValue(item.key)"
              :disabled="canShowFieldOrView(item)"
              :table-id="getValue(item.parentTable)"
              :data-testid="`nc-script-config-view-${item.key}`"
              @update:value="(value) => handleFieldOrViewChange(item, value)"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'field'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <NcListColumnSelector
              :disabled="canShowFieldOrView(item)"
              disable-label
              :table-id="getValue(item.parentTable)"
              :value="getValue(item.key)"
              :data-testid="`nc-script-config-field-${item.key}`"
              @update:value="(value) => handleFieldOrViewChange(item, value)"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'text'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <a-input
              v-model:value="configValue[item.key]"
              type="text"
              class="nc-input-sm nc-input-shadow"
              :data-testid="`nc-script-config-text-${item.key}`"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'number'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <a-input
              v-model:value="configValue[item.key]"
              type="number"
              class="nc-input-sm nc-input-shadow"
              :data-testid="`nc-script-config-number-${item.key}`"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'select'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <a-select
              v-model:value="configValue[item.key]"
              class="nc-select-shadow"
              show-search
              :data-testid="`nc-script-config-select-${item.key}`"
            >
              <template #suffixIcon>
                <GeneralIcon icon="arrowDown" class="text-gray-700" />
              </template>
              <a-select-option v-for="option in item.options" :key="option.value" :value="option.value">
                <div class="flex gap-2 w-full justify-between items-center">
                  {{ option.label || option.value }}
                  <GeneralIcon
                    v-if="configValue[item.key] === option.value"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </a-select>
          </div>
        </template>
      </div>

      <NcTooltip v-if="hasInput" class="w-full" :disabled="isConfigValid">
        <template #title> Please fill in all required fields </template>
        <NcButton
          :loading="isLoading"
          class="w-full"
          size="small"
          :disabled="!isConfigValid"
          data-testid="nc-script-config-save-btn"
          @click="triggerUpdate"
        >
          Save
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.config-wrapper {
  height: calc(100svh - var(--topbar-height) - var(--footer-height));
}
</style>
