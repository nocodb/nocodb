<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'

interface Props {
  value?: string | string[] | null
  tableId?: string
  options?: any[]
  multiple?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:value': [value: string | string[] | null | undefined]
}>()

const modelValue = useVModel(props, 'value', emit)

const isOpenViewSelectDropdown = ref(false)

const viewList = computed(() => {
  return (props.options || []).map((opt: any) => ({
    label: opt.label,
    value: opt.value,
    ncItemDisabled: opt.ncItemDisabled || false,
    ncItemTooltip: opt.ncItemTooltip || '',
    ...opt,
  }))
})

const viewListMap = computed(() => {
  if (!viewList.value || viewList.value.length === 0) return new Map()
  return new Map(viewList.value.map((view) => [view.value, view]))
})

const selectedView = computed(() => {
  if (!viewListMap.value || viewListMap.value.size === 0) return undefined
  if (props.multiple && Array.isArray(modelValue.value)) {
    return modelValue.value.map((val) => viewListMap.value.get(val)).filter(Boolean)
  }
  return viewListMap.value.get(modelValue.value as string) || undefined
})

const selectedViewLabel = computed(() => {
  if (!selectedView.value) return '-- Select view --'
  if (Array.isArray(selectedView.value)) {
    return selectedView.value.length > 0
      ? `${selectedView.value.length} view${selectedView.value.length > 1 ? 's' : ''} selected`
      : '-- Select view --'
  }
  return selectedView.value.label
})

const handleValueUpdate = (value: any) => {
  modelValue.value = value
}
</script>

<template>
  <NcListDropdown v-model:is-open="isOpenViewSelectDropdown" :has-error="!!selectedView?.ncItemDisabled">
    <div class="flex-1 flex items-center gap-2 min-w-0">
      <div v-if="selectedView && !Array.isArray(selectedView)" class="min-w-5 flex items-center justify-center">
        <NcIconView :view="selectedView.view as ViewType" class="text-nc-content-muted" />
      </div>
      <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
        <span
          class="text-sm flex-1 truncate"
          :class="{ 'text-nc-content-gray-muted': !selectedView || (Array.isArray(selectedView) && selectedView.length === 0) }"
        >
          {{ selectedViewLabel }}
        </span>

        <template #title>
          {{ selectedViewLabel }}
        </template>
      </NcTooltip>

      <GeneralIcon
        icon="ncChevronDown"
        class="flex-none h-4 w-4 transition-transform opacity-70"
        :class="{ 'transform rotate-180': isOpenViewSelectDropdown }"
      />
    </div>
    <template #overlay="{ onEsc }">
      <NcList
        v-model:open="isOpenViewSelectDropdown"
        :value="multiple ? (Array.isArray(modelValue) ? modelValue : []) : modelValue || ''"
        :list="viewList"
        :is-multi-select="multiple"
        :close-on-select="!multiple"
        variant="medium"
        class="!w-auto"
        wrapper-class-name="!h-auto"
        @update:value="handleValueUpdate"
        @escape="onEsc"
      >
        <template #listItemExtraLeft="{ option }">
          <div class="min-w-5 flex items-center justify-center">
            <NcIconView :view="option.view" class="text-nc-content-gray-muted" />
          </div>
        </template>
      </NcList>
    </template>
  </NcListDropdown>
</template>
