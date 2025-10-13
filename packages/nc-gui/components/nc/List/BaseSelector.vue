<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'

interface Props {
  workspaceId?: string
  value?: string | null | undefined
  forceLayout?: 'vertical' | 'horizontal'
  filterBase?: (base: BaseType) => boolean
  forceLoadBases?: boolean
  disableLabel?: boolean
  autoSelect?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  forceLoadBases: false,
  disableLabel: false,
  autoSelect: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:value': [value: string | null | undefined]
}>()

const { t } = useI18n()

const { $api } = useNuxtApp()
const { getBaseUrl } = useGlobal()
const workspaceStore = useWorkspace()

const modelValue = useVModel(props, 'value', emit)

const isOpenBaseSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  modelValue.value = value
}

const baseList = computedAsync(async () => {
  let basesList: BaseType[] = []

  try {
    if (isEeUI) {
      const wsId = props.workspaceId || workspaceStore.activeWorkspace?.id
      if (!wsId) return []
      const { list } = await $api.workspaceBase.list(wsId, {
        baseURL: getBaseUrl(wsId),
      })
      basesList = list || []
    } else {
      const { list } = await $api.base.list()
      basesList = list || []
    }
  } catch (error) {
    console.error('Failed to load bases:', error)
    basesList = []
  }

  if (props.filterBase) {
    basesList = basesList.filter(props.filterBase)
  }

  return basesList.map((base) => {
    const ncItemTooltip = ''

    return {
      label: base.title || base.id,
      value: base.id,
      ncItemDisabled: false,
      ncItemTooltip,
      ...base,
    }
  })
}, [])

const baseListMap = computed(() => {
  if (!baseList.value || baseList.value.length === 0) return new Map()

  return new Map(baseList.value.map((base) => [base.value, base]))
})

const selectedBase = computed(() => {
  if (!baseListMap.value || baseListMap.value.size === 0) return undefined

  return baseListMap.value.get(modelValue.value) || undefined
})

watch(
  baseList,
  (newBaseList) => {
    if (newBaseList && newBaseList.length > 0) {
      const baseValueSet = new Set(newBaseList.map((base) => base.value))

      // Check if current value exists in the new base list
      if (modelValue.value && !baseValueSet.has(modelValue.value)) {
        // Current value is not in the list, set null to clear it
        modelValue.value = null
        return
      }

      // Auto-select logic (only if autoSelect is enabled and no current value)
      if (!modelValue.value && props.autoSelect) {
        const firstBase = newBaseList[0]

        if (firstBase.ncItemDisabled) {
          modelValue.value = newBaseList.find((base) => !base.ncItemDisabled)?.value || firstBase.value
        } else {
          modelValue.value = firstBase.value
        }
      }
    }
  },
  { immediate: true },
)

defineExpose({
  modelValue,
  selectedBase,
  isOpenBaseSelectDropdown,
  baseList,
  baseListMap,
})
</script>

<template>
  <a-form-item
    name="baseId"
    class="!mb-0 nc-base-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedBase?.ncItemDisabled ? 'error' : ''"
    :help="selectedBase?.ncItemDisabled ? [selectedBase.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>
        <slot name="label">{{ t('objects.project') }}</slot>
      </div>
    </template>
    <NcListDropdown v-model:is-open="isOpenBaseSelectDropdown" :disabled="disabled" :has-error="!!selectedBase?.ncItemDisabled">
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div v-if="selectedBase" class="min-w-5 flex items-center justify-center">
          <GeneralProjectIcon :color="parseProp(selectedBase.meta).iconColor" size="small" />
        </div>
        <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
          <span
            v-if="selectedBase"
            :key="selectedBase?.value"
            class="text-sm flex-1 truncate"
            :class="{ 'text-nc-content-gray-muted': !selectedBase }"
          >
            {{ selectedBase?.label }}
          </span>
          <span v-else class="text-sm flex-1 truncate text-nc-content-gray-muted">-- Select base --</span>

          <template #title>
            {{ selectedBase?.label || 'Select base' }}
          </template>
        </NcTooltip>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenBaseSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenBaseSelectDropdown"
          :value="modelValue || selectedBase?.value || ''"
          :list="baseList"
          variant="medium"
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #item="{ item }">
            <div class="w-full flex items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralProjectIcon :color="parseProp(item.meta).iconColor" size="small" />
              </div>
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
.nc-base-selector.ant-form-item {
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
