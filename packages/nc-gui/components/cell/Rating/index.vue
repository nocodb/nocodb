<script setup lang="ts">
interface Props {
  modelValue?: number | null | undefined
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const ratingMeta = computed(() => {
  const icon = extractRatingIcon(column?.value?.meta)
  return {
    color: '#fcb401',
    max: 5,
    ...parseProp(column.value?.meta),
    icon,
  }
})

const vModel = computed({
  get: () => Number(modelValue),
  set: (val) => emits('update:modelValue', val),
})

useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
  if (/^\d$/.test(e.key)) {
    e.stopPropagation()
    vModel.value = +e.key === +vModel.value ? 0 : +e.key
  }
})

const onKeyPress = (e: KeyboardEvent) => {
  if (/^\d$/.test(e.key)) {
    e.stopPropagation()
    vModel.value = +e.key === +vModel.value ? 0 : +e.key
  }
}

const rateDomRef = ref()

// Remove tabindex from rate inputs set by antd
watch(rateDomRef, () => {
  if (!rateDomRef.value) return

  const rateInputs = rateDomRef.value.$el.querySelectorAll('div[role="radio"]')
  if (!rateInputs) return

  for (let i = 0; i < rateInputs.length; i++) {
    rateInputs[i].setAttribute('tabindex', '-1')
  }
})
</script>

<template>
  <a-rate
    ref="rateDomRef"
    :key="ratingMeta.icon.full"
    v-model:value="vModel"
    :disabled="readOnly"
    :count="ratingMeta.max"
    :class="readOnly ? 'pointer-events-none' : ''"
    :style="{
      'color': ratingMeta.color,
      'padding': isExpandedFormOpen ? '0px 8px' : '0px 2px',
      'display': '-webkit-box',
      'max-width': '100%',
      '-webkit-line-clamp': rowHeight === 6 ? 5 : rowHeightTruncateLines(rowHeight, true),
      '-webkit-box-orient': 'vertical',
      'overflow': 'hidden',
      'line-height': '16px',
    }"
    @keydown="onKeyPress"
  >
    <template #character>
      <MdiStar v-if="ratingMeta.icon.full === 'mdi-star'" class="text-sm" />
      <MdiHeart v-if="ratingMeta.icon.full === 'mdi-heart'" class="text-sm" />
      <MdiMoonFull v-if="ratingMeta.icon.full === 'mdi-moon-full'" class="text-sm" />
      <MdiThumbUp v-if="ratingMeta.icon.full === 'mdi-thumb-up'" class="text-sm" />
      <MdiFlag v-if="ratingMeta.icon.full === 'mdi-flag'" class="text-sm" />
    </template>
  </a-rate>
</template>

<style scoped lang="scss">
:deep(li:not(:last-child)) {
  @apply mr-[1.5px];
}
</style>
