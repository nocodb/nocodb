<script setup lang="ts">
import { ActiveCellInj, ColumnInj, computed, inject, useSelectedCellKeyupListener } from '#imports'

interface Props {
  modelValue?: number | null | undefined
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const ratingMeta = computed(() => {
  return {
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
    ...(column.value?.meta || {}),
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
</script>

<template>
  <a-rate v-model:value="vModel" :count="ratingMeta.max" :style="`color: ${ratingMeta.color}; padding: 0px 5px`">
    <template #character>
      <MdiStar v-if="ratingMeta.icon.full === 'mdi-star'" class="text-sm" />
      <MdiHeart v-if="ratingMeta.icon.full === 'mdi-heart'" class="text-sm" />
      <MdiMoonFull v-if="ratingMeta.icon.full === 'mdi-moon-full'" class="text-sm" />
      <MdiThumbUp v-if="ratingMeta.icon.full === 'mdi-thumb-up'" class="text-sm" />
      <MdiFlag v-if="ratingMeta.icon.full === 'mdi-flag'" class="text-sm" />
    </template>
  </a-rate>
</template>
