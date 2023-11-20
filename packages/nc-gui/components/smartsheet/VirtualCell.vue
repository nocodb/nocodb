<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellValueInj,
  ColumnInj,
  IsExpandedFormOpenInj,
  IsFormInj,
  IsGridInj,
  NavigateDir,
  RowInj,
  SaveRowInj,
  inject,
  isBarcode,
  isBt,
  isCount,
  isFormula,
  isHm,
  isLink,
  isLookup,
  isMm,
  isQrCode,
  isRollup,
  provide,
  toRef,
} from '#imports'
import type { Row } from '#imports'

const props = defineProps<{
  column: ColumnType
  modelValue: any
  row?: Row
  active?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'navigate', 'save'])

const column = toRef(props, 'column')
const active = toRef(props, 'active', false)
const row = toRef(props, 'row')

provide(ColumnInj, column)
provide(ActiveCellInj, active)
provide(RowInj, row)
provide(CellValueInj, toRef(props, 'modelValue'))
provide(SaveRowInj, () => emit('save'))

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

function onNavigate(dir: NavigateDir, e: KeyboardEvent) {
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}

// Todo: move intersection logic to a separate component or a vue directive
const intersected = ref(false)

const intersectionObserver = ref<IntersectionObserver>()

const elementToObserve = ref<Element>()

// load the cell only when it is in the viewport
function initIntersectionObserver() {
  intersectionObserver.value = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // if the cell is in the viewport, load the cell and disconnect the observer
      if (entry.isIntersecting) {
        intersected.value = true
        intersectionObserver.value?.disconnect()
        intersectionObserver.value = undefined
      }
    })
  })
}

// observe the cell when it is mounted
onMounted(() => {
  initIntersectionObserver()
  intersectionObserver.value?.observe(elementToObserve.value!)
})

// disconnect the observer when the cell is unmounted
onUnmounted(() => {
  intersectionObserver.value?.disconnect()
})
</script>

<template>
  <div
    ref="elementToObserve"
    class="nc-virtual-cell w-full flex items-center"
    :class="{ 'text-right justify-end': isGrid && !isForm && isRollup(column) && !isExpandedForm }"
    @keydown.enter.exact="onNavigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="onNavigate(NavigateDir.PREV, $event)"
  >
    <template v-if="intersected">
      <LazyVirtualCellLinks v-if="isLink(column)" />
      <LazyVirtualCellHasMany v-else-if="isHm(column)" />
      <LazyVirtualCellManyToMany v-else-if="isMm(column)" />
      <LazyVirtualCellBelongsTo v-else-if="isBt(column)" />
      <LazyVirtualCellRollup v-else-if="isRollup(column)" />
      <LazyVirtualCellFormula v-else-if="isFormula(column)" />
      <LazyVirtualCellQrCode v-else-if="isQrCode(column)" />
      <LazyVirtualCellBarcode v-else-if="isBarcode(column)" />
      <LazyVirtualCellCount v-else-if="isCount(column)" />
      <LazyVirtualCellLookup v-else-if="isLookup(column)" />
    </template>
  </div>
</template>
