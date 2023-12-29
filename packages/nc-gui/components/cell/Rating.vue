<script setup lang="ts">
import {
  ActiveCellInj,
  ColumnInj,
  IsExpandedFormOpenInj,
  computed,
  inject,
  parseProp,
  useSelectedCellKeyupListener,
} from '#imports'

interface Props {
  modelValue?: number | null | undefined
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const readonly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const ratingMeta = computed(() => {
  return {
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
    ...parseProp(column.value?.meta),
  }
})

const vModel = computed({
  get: () => modelValue ?? NaN,
  set: (val) => emits('update:modelValue', val),
})

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e: KeyboardEvent) => {
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
    v-model:value="vModel"
    :disabled="readonly"
    :count="ratingMeta.max"
    :style="`color: ${ratingMeta.color}; padding: ${isExpandedFormOpen ? '0px 8px' : '0px 5px'};`"
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
