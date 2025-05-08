<script setup lang="ts">
interface ConfigItem {
  type: 'table' | 'field' | 'view' | 'text' | 'number' | 'select'
  key: string
  label?: string
  description?: string
  parentTable?: string
  options?: Array<{ value: string; label?: string }>
}

interface ScriptConfig {
  title: string
  description?: string
  items: ConfigItem[]
}

interface Props {
  config: ScriptConfig
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const configValue = useVModel(props, 'modelValue', emit)

const getValue = (key: string) => configValue.value[key]?.value || ''

const canShowFieldOrView = (item: ConfigItem): boolean => {
  if (!item?.parentTable) return true
  return !getValue(item.parentTable)
}

const handleTableChange = (key: string, value: any) => {
  configValue.value[key] = value
    ? { type: 'table', value }
    : undefined(props.config?.items ?? []).forEach((item) => {
        if (item.parentTable === key) {
          configValue.value[item.key] = undefined
        }
      })
}

const handleFieldOrViewChange = (item: ConfigItem, value: any) => {
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
  <div class="p-4 overflow-y-auto h-[95svh] nc-scrollbar-md">
    <h1 v-if="config?.title" class="text-2xl text-nc-content-gray font-semibold">
      {{ config?.title }}
    </h1>
    <p class="text-nc-content-gray leading-5">
      {{ config?.description }}
    </p>

    <div class="py-2">
      <div v-for="item in config?.items" :key="item.key" class="pb-4">
        <template v-if="item.type === 'table'">
          <div class="flex flex-col">
            <div v-if="item?.label || item?.key" class="font-semibold text-nc-content-gray">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="mb-2">
              {{ item.description }}
            </div>
            <NSelectTable
              :value="getValue(item.key)"
              allow-clear
              class="w-64"
              @change="(value) => handleTableChange(item.key, value)"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'view'">
          <div class="flex flex-col">
            <div v-if="item?.label || item?.key" class="font-semibold text-nc-content-gray">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="mb-2">
              {{ item.description }}
            </div>
            <NSelectView
              :value="getValue(item.key)"
              :table-id="getValue(item.parentTable)"
              :disabled="canShowFieldOrView(item)"
              allow-clear
              class="w-64"
              @change="(value) => handleFieldOrViewChange(item, value)"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'field'">
          <div class="flex flex-col">
            <div v-if="item?.label || item?.key" class="font-semibold text-nc-content-gray">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="mb-2">
              {{ item.description }}
            </div>
            <NSelectField
              :value="getValue(item.key)"
              :table-id="getValue(item.parentTable)"
              :disabled="canShowFieldOrView(item)"
              allow-clear
              class="w-64"
              @change="(value) => handleFieldOrViewChange(item, value)"
            />
          </div>
        </template>

        <template v-else-if="item.type === 'text'">
          <div class="flex flex-col">
            <div v-if="item?.label || item?.key" class="font-semibold text-nc-content-gray">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="mb-2">
              {{ item.description }}
            </div>
            <a-input v-model:value="configValue[item.key]" type="text" class="nc-input-sm !w-64 nc-input-shadow" />
          </div>
        </template>

        <template v-else-if="item.type === 'number'">
          <div class="flex flex-col">
            <div v-if="item?.label || item?.key" class="font-semibold text-nc-content-gray">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="mb-2">
              {{ item.description }}
            </div>
            <a-input-number v-model:value="configValue[item.key]" class="nc-input-sm !w-64 nc-input-shadow" />
          </div>
        </template>

        <template v-else-if="item.type === 'select'">
          <div class="flex flex-col">
            <div v-if="item?.label || item?.key" class="font-semibold text-nc-content-gray">
              {{ item.label || item.key }}
            </div>
            <div v-if="item?.description" class="mb-2">
              {{ item.description }}
            </div>
            <a-select v-model:value="configValue[item.key]" class="w-64" show-search>
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
    </div>
  </div>
</template>
