<script setup lang="ts">
interface Props {
  // If the previous cell value was a text, the initial checkbox value is a string type
  // otherwise it can be either a boolean, or a string representing a boolean, i.e '0' or '1'
  modelValue?: boolean | string | number | '0' | '1'
}

interface Emits {
  (event: 'update:modelValue', model: boolean): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const active = inject(ActiveCellInj, ref(false))

const { isMssql } = useBase()

const column = inject(ColumnInj)

const isForm = inject(IsFormInj)

const isEditColumnMenu = inject(EditColumnInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const readOnly = inject(ReadonlyInj)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const rowHeight = inject(RowHeightInj, ref())

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const checkboxMeta = computed(() => {
  const icon = extractCheckboxIcon(column?.value?.meta)

  return {
    color: 'primary',
    ...parseProp(column?.value?.meta),
    icon,
  }
})

const vModel = computed<boolean | number>({
  get: () => !!props.modelValue && props.modelValue !== '0' && props.modelValue !== 0 && props.modelValue !== 'false',
  set: (val: any) => emits('update:modelValue', isMssql(column?.value?.source_id) ? +val : val),
})

function onClick(force?: boolean, event?: MouseEvent | KeyboardEvent) {
  if (
    (event?.target as HTMLElement)?.classList?.contains('nc-checkbox') ||
    (event?.target as HTMLElement)?.closest('.nc-checkbox')
  ) {
    return
  }
  if (!readOnly?.value && (force || active.value)) {
    vModel.value = !vModel.value
  }
}

const keydownEnter = (e: KeyboardEvent) => {
  if (!isSurveyForm.value) {
    onClick(true, e)
    e.stopPropagation()
  }
}
const keydownSpace = (e: KeyboardEvent) => {
  if (isSurveyForm.value) {
    onClick(true, e)
    e.stopPropagation()
  }
}

useSelectedCellKeydownListener(
  active,
  (e) => {
    switch (e.key) {
      case 'Enter':
        onClick()
        e.stopPropagation()
        break
    }
  },
  {
    immediate: true,
    isGridCell: true,
  },
)

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
      'nc-cell-hover-show': !vModel.value && !readOnly?.value,
      'opacity-0': readOnly?.value && !vModel.value,
      'pointer-events-none': readOnly?.value,
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
    class="flex cursor-pointer w-full h-full items-center focus:outline-none"
    :class="wrapperClassName"
    :style="{
      height,
    }"
    :tabindex="readOnly ? -1 : 0"
    @click="onClick(false, $event)"
    @keydown.enter="keydownEnter"
    @keydown.space="keydownSpace($event)"
  >
    <div class="flex items-center" :class="childClassName" @click.stop="onClick(true)">
      <Transition name="layout" mode="out-in" :duration="100">
        <component
          :is="getMdiIcon(vModel ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
          class="nc-checkbox"
          :style="{
            color: checkboxMeta.color,
          }"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-cell-hover-show {
  opacity: 0.3;
  transition: 0.3s opacity;

  &:hover {
    opacity: 0.7;
  }
}
</style>
