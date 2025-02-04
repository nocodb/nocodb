<script setup lang="ts">
interface Props {
  // If the previous cell value was a text, the initial checkbox value is a string type
  // otherwise it can be either a boolean, or a string representing a boolean, i.e '0' or '1'
  modelValue?: boolean | string | number | '0' | '1'
}

const { modelValue: _modelValue } = defineProps<Props>()

const column = inject(ColumnInj)

const isForm = inject(IsFormInj)

const isEditColumnMenu = inject(EditColumnInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const rowHeight = inject(RowHeightInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const checkboxMeta = computed(() => {
  const icon = extractCheckboxIcon(column?.value?.meta)

  return {
    color: 'primary',
    ...parseProp(column?.value?.meta),
    icon,
  }
})

const modelValue = computed(() => !!_modelValue && _modelValue !== '0' && _modelValue !== 0 && _modelValue !== 'false')

const height = computed(() => {
  if (isGrid.value && !isExpandedFormOpen.value) {
    return `${!rowHeight.value || rowHeight.value === 1 ? rowHeightInPx['1'] - 4 : rowHeightInPx[`${rowHeight.value}`] - 20}px`
  } else {
    return undefined
  }
})

const wrapperClassName = computed(() => {
  return [
    isForm?.value || isGallery.value || isExpandedFormOpen.value ? 'w-full flex-start pl-2' : 'w-full justify-center',
    {
      'opacity-0': !modelValue.value,
    },
  ]
})

const childClassName = computed(() => {
  return [
    isEditColumnMenu.value || isGallery.value || isKanban.value || isForm?.value ? 'w-full justify-start' : 'justify-center',
    { 'py-2': isEditColumnMenu.value },
  ]
})
</script>

<template>
  <div
    class="flex w-full h-full items-center focus:outline-none pointer-events-none"
    :class="wrapperClassName"
    :style="{
      height,
    }"
  >
    <div class="flex items-center" :class="childClassName">
      <Transition name="layout" mode="out-in" :duration="100">
        <component
          :is="getMdiIcon(modelValue ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
          class="nc-checkbox"
          :style="{
            color: checkboxMeta.color,
          }"
        />
      </Transition>
    </div>
  </div>
</template>
