<script lang="ts" setup>
import type { ScriptType } from 'nocodb-sdk'

interface Props {
  baseId?: string
  value?: string | null | undefined
  forceLayout?: 'vertical' | 'horizontal'
  filterScript?: (script: ScriptType) => boolean
  mapScript?: (script: ScriptType) => ScriptType
  forceLoadScripts?: boolean
  disableLabel?: boolean
  autoSelect?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  forceLoadScripts: false,
  disableLabel: false,
  autoSelect: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:value': [value: string | null | undefined]
}>()

const { t } = useI18n()

const automationStore = useAutomationStore()

const modelValue = useVModel(props, 'value', emit)

const isOpenScriptSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  modelValue.value = value
}

const scriptList = computedAsync(async () => {
  let scripts: ScriptType[] = []

  if (props.baseId) {
    scripts = await automationStore.loadAutomations({
      baseId: props.baseId,
      force: props.forceLoadScripts,
    })
  } else {
    // If no baseId provided, return empty array
    scripts = []
  }

  if (props.filterScript) {
    scripts = scripts.filter(props.filterScript)
  }

  if (props.mapScript) {
    scripts = scripts.map(props.mapScript).filter(Boolean)
  }

  return scripts.map((script) => {
    return {
      label: script.title || 'Untitled Script',
      value: script.id,
      ncItemDisabled: (script as any).ncItemDisabled || false,
      ncItemTooltip: (script as any).ncItemTooltip || '',
      ...script,
    }
  })
}, [])

const scriptListMap = computed(() => {
  if (!scriptList.value || scriptList.value.length === 0) return new Map()

  return new Map(scriptList.value.map((script) => [script.value, script]))
})

const selectedScript = computed(() => {
  if (!scriptListMap.value || scriptListMap.value.size === 0) return undefined

  return scriptListMap.value.get(modelValue.value) || undefined
})

watch(
  scriptList,
  (newScriptList) => {
    if (newScriptList && newScriptList.length > 0) {
      const newScriptListMap = new Map(newScriptList.map((script) => [script.value, script]))

      // Check if current value exists in the new script list
      if (modelValue.value && !newScriptListMap.has(modelValue.value)) {
        // Current value is not in the list, set null to clear it
        modelValue.value = null
        return
      }

      // Auto-select logic (only if autoSelect is enabled and no current value)
      if (!modelValue.value && props.autoSelect) {
        const newScriptId = newScriptList[0]?.value

        const scriptObj = newScriptListMap.get(newScriptId)

        if (scriptObj && scriptObj.ncItemDisabled && scriptObj.value === newScriptList[0]?.value) {
          modelValue.value = newScriptList.find((script) => !script.ncItemDisabled)?.value || newScriptList[0]?.value
        } else {
          modelValue.value = newScriptId
        }
      }
    }
  },
  { immediate: true },
)

defineExpose({
  modelValue,
  selectedScript,
  isOpenScriptSelectDropdown,
  scriptList,
  scriptListMap,
})
</script>

<template>
  <a-form-item
    name="scriptId"
    class="!mb-0 nc-script-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedScript?.ncItemDisabled ? 'error' : ''"
    :help="selectedScript?.ncItemDisabled ? [selectedScript.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>
        <slot name="label">{{ t('general.script') }}</slot>
      </div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenScriptSelectDropdown"
      :disabled="disabled"
      :has-error="!!selectedScript?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div v-if="selectedScript" class="min-w-5 flex items-center justify-center">
          <NcIconAutomation :automation="selectedScript" />
        </div>
        <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
          <span
            v-if="selectedScript"
            :key="selectedScript?.value"
            class="text-sm flex-1 truncate"
            :class="{ 'text-nc-content-gray-muted': !selectedScript }"
          >
            {{ selectedScript?.label }}
          </span>
          <span v-else class="text-sm flex-1 truncate text-nc-content-gray-muted">-- Select script --</span>

          <template #title>
            {{ selectedScript?.label || 'Select a script' }}
          </template>
        </NcTooltip>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenScriptSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenScriptSelectDropdown"
          :value="modelValue || selectedScript?.value || ''"
          :list="scriptList"
          variant="medium"
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ option }">
            <NcIconAutomation :automation="option as ScriptType" />
          </template>

          <template #item="{ item }">
            <div class="w-full flex items-center gap-2">
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ item.label }}</template>
                <span>{{ item.label }}</span>
              </NcTooltip>
              <component
                :is="iconMap.check"
                v-if="modelValue === item.value"
                id="nc-selected-item-icon"
                class="flex-none text-primary w-4 h-4"
              />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>

<style lang="scss">
.nc-script-selector.ant-form-item {
  &.nc-force-layout-vertical {
    @apply !flex-col;

    & > .ant-form-item-label {
      @apply pb-2 text-left;

      &::after {
        @apply hidden;
      }

      & > label {
        @apply !h-auto;
        &::after {
          @apply !hidden;
        }
      }
    }
  }

  &.nc-force-layout-horizontal {
    @apply !flex-row !items-center;

    & > .ant-form-item-label {
      @apply pb-0 items-center;

      &::after {
        @apply content-[':'] !mr-2 !ml-0.5 relative top-[0.5px];
      }
    }
  }
}
</style>
