<script setup lang="ts">
import { validateConfigValues } from '~/components/smartsheet/automation/scripts/utils/configParser'
import type { ScriptConfig, ScriptConfigItem } from '~/lib/types'

interface Props {
  config: ScriptConfig
  modelValue: Record<string, any>
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'change'])

const { isUIAllowed } = useRoles()

const automationStore = useAutomationStore()

const { activeProjectId } = storeToRefs(useBases())

const { activeAutomationId } = storeToRefs(automationStore)

const { updateAutomation } = automationStore

const configValue = useVModel(props, 'modelValue', emit)

const isLoading = ref(false)

const getValue = (key: string) => configValue.value[key]?.value || ''

const canShowFieldOrView = (item: ScriptConfigItem): boolean => {
  if (!item?.parentTable) return true
  return !getValue(item.parentTable)
}

const isConfigValid = computed(() => {
  const res = validateConfigValues(props.config, configValue.value)
  return res.length === 0
})

const handleTableChange = (key: string, value: any) => {
  configValue.value[key] = value ? { type: 'table', value } : undefined
  ;(props.config?.items ?? []).forEach((item) => {
    if (item.parentTable === key) {
      configValue.value[item.key] = undefined
    }
  })
}

const handleFieldOrViewChange = (item: ScriptConfigItem, value: any) => {
  if (value && item.parentTable) {
    configValue.value[item.key] = {
      type: item.type,
      value,
      tableId: configValue.value[item.parentTable]?.value,
    }
  } else {
    configValue.value[item.key] = value ? { type: item.type, value } : undefined
  }
}

const triggerUpdate = async (val) => {
  try {
    isLoading.value = true
    await updateAutomation(
      activeProjectId.value,
      activeAutomationId.value,
      {
        config: val,
      },
      {
        skipNetworkCall: !isUIAllowed('scriptCreateOrEdit'),
      },
    )
    message.toast('Script settings saved!')
  } catch (error) {
    message.error(await extractSdkResponseErrorMsgv2(error))
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  ;(props.config?.items ?? []).forEach((item) => {
    if (item.type === 'table') {
      configValue.value[item.key] = configValue.value[item.key] || { type: item.type, value: '' }
    } else if (['field', 'view'].includes(item.type) && item.parentTable) {
      configValue.value[item.key] = configValue.value[item.key] || {
        type: item.type,
        value: '',
        tableId: configValue.value[item.parentTable]?.value,
      }
    }
  })
})
</script>

<template>
  <div class="p-6 overflow-y-auto bg-nc-bg-gray-extralight border-l-1 border-nc-border-gray-medium h-[95svh] nc-scrollbar-md">
    <div class="flex mx-auto flex-col max-w-130 gap-6">
      <div>
        <div v-if="config?.title" class="text-subHeading2 text-nc-content-gray-emphasis">
          {{ config?.title }}
        </div>
        <div v-if="config?.description" class="text-nc-content-gray-subtle2 text-body mt-2">
          {{ config?.description }}
        </div>
      </div>

      <div v-for="item in config?.items" :key="item.key">
        <template v-if="item.type === 'table'">
          <div class="flex flex-col gap-2">
            <div v-if="item?.label || item?.key" class="text-caption text-nc-content-gray-subtle2">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="text-nc-content-gray-subtle2 text-bodySm">
              {{ item.description }}
            </div>
            <NSelectTable :value="getValue(item.key)" allow-clear @change="(value) => handleTableChange(item.key, value)" />
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
            <NSelectView
              :value="getValue(item.key)"
              :table-id="getValue(item.parentTable)"
              :disabled="canShowFieldOrView(item)"
              allow-clear
              @change="(value) => handleFieldOrViewChange(item, value)"
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
            <NSelectField
              :value="getValue(item.key)"
              :table-id="getValue(item.parentTable)"
              :disabled="canShowFieldOrView(item)"
              allow-clear
              @change="(value) => handleFieldOrViewChange(item, value)"
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
            <a-input v-model:value="configValue[item.key]" type="text" class="nc-input-sm nc-input-shadow" />
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
            <a-input-number v-model:value="configValue[item.key]" class="nc-input-sm nc-input-shadow" />
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
            <a-select v-model:value="configValue[item.key]" show-search>
              <template #suffixIcon>
                <GeneralIcon icon="arrowDown" class="text-gray-700" />
              </template>
              <a-select-option v-for="option in item.options" :key="option.value" :value="option.value">
                <div class="flex gap-2 w-full justify-between items-center">
                  {{ option.label }}
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

      <NcTooltip class="w-full" :disabled="isConfigValid">
        <template #title> Please fill in all required fields </template>
        <NcButton :loading="isLoading" class="w-full" size="small" :disabled="!isConfigValid" @click="triggerUpdate">
          Save
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>
