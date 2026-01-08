<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

interface Props {
  value?: string | null | undefined
  forceLayout?: 'vertical' | 'horizontal'
  filterWorkspace?: (workspace: WorkspaceType) => boolean
  disableLabel?: boolean
  autoSelect?: boolean
  disabled?: boolean
  placeholder?: string
  workspaceList?: WorkspaceType[]
}

const props = withDefaults(defineProps<Props>(), {
  disableLabel: false,
  autoSelect: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:value': [value: string | null | undefined]
}>()

const { t } = useI18n()

const workspaceStore = useWorkspace()

const modelValue = useVModel(props, 'value', emit)

const isOpenWorkspaceSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  modelValue.value = value
}

const workspaceList = computedAsync(async () => {
  let wsList = ncIsArray(props.workspaceList) ? props.workspaceList : (await workspaceStore.loadWorkspaces()) || []

  if (props.filterWorkspace) {
    wsList = wsList.filter(props.filterWorkspace)
  }

  return wsList.map((workspace) => {
    const ncItemTooltip = ''

    return {
      label: workspace.title || workspace.id,
      value: workspace.id,
      ncItemDisabled: false,
      ncItemTooltip,
      ...workspace,
    }
  })
}, [])

const workspaceListMap = computed(() => {
  if (!workspaceList.value || workspaceList.value.length === 0) return new Map()

  return new Map(workspaceList.value.map((workspace) => [workspace.value, workspace]))
})

const selectedWorkspace = computed(() => {
  if (!workspaceListMap.value || workspaceListMap.value.size === 0) return undefined

  return workspaceListMap.value.get(modelValue.value) || undefined
})

watch(
  workspaceList,
  (newWorkspaceList) => {
    if (newWorkspaceList && newWorkspaceList.length > 0) {
      const workspaceValueSet = new Set(newWorkspaceList.map((workspace) => workspace.value))

      // Check if current value exists in the new workspace list
      if (modelValue.value && !workspaceValueSet.has(modelValue.value)) {
        // Current value is not in the list, set null to clear it
        modelValue.value = null
        return
      }

      // Auto-select logic (only if autoSelect is enabled and no current value)
      if (!modelValue.value && props.autoSelect) {
        const firstWorkspace = newWorkspaceList[0]

        if (firstWorkspace.ncItemDisabled) {
          modelValue.value = newWorkspaceList.find((workspace) => !workspace.ncItemDisabled)?.value || firstWorkspace.value
        } else {
          modelValue.value = firstWorkspace.value
        }
      }
    }
  },
  { immediate: true },
)

defineExpose({
  modelValue,
  selectedWorkspace,
  isOpenWorkspaceSelectDropdown,
  workspaceList,
  workspaceListMap,
})
</script>

<template>
  <a-form-item
    name="workspaceId"
    class="!mb-0 nc-workspace-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedWorkspace?.ncItemDisabled ? 'error' : ''"
    :help="selectedWorkspace?.ncItemDisabled ? [selectedWorkspace.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>
        <slot name="label">{{ t('objects.workspace') }}</slot>
      </div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenWorkspaceSelectDropdown"
      :disabled="disabled"
      :has-error="!!selectedWorkspace?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div v-if="selectedWorkspace" class="min-w-5 flex items-center justify-center">
          <GeneralWorkspaceIcon :workspace="selectedWorkspace" size="account-sidebar" />
        </div>
        <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
          <span
            v-if="selectedWorkspace"
            :key="selectedWorkspace?.value"
            class="text-sm flex-1 truncate"
            :class="{ 'text-nc-content-gray-muted': !selectedWorkspace }"
          >
            {{ selectedWorkspace?.label }}
          </span>
          <span v-else class="text-sm flex-1 truncate text-nc-content-gray-muted">
            <slot name="placeholder">{{ placeholder || '-- Select workspace --' }}</slot>
          </span>

          <template #title>
            {{ selectedWorkspace?.label || 'Select workspace' }}
          </template>
        </NcTooltip>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenWorkspaceSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenWorkspaceSelectDropdown"
          :value="modelValue || selectedWorkspace?.value || ''"
          :list="workspaceList"
          variant="medium"
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ option }">
            <div class="min-w-5 flex items-center justify-center">
              <GeneralWorkspaceIcon :workspace="option as WorkspaceType" size="account-sidebar" class="flex-none" />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>

<style lang="scss">
.nc-workspace-selector.ant-form-item {
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
