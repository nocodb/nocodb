<script setup lang="ts">
import { ColumnInj, EditModeInj, computed, inject } from '#imports'

interface Props {
  modelValue?: number | null | undefined
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj)

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
</script>

<template>
  <a-rate v-model:value="vModel" :count="ratingMeta.max" :style="`color: ${ratingMeta.color}`" :disabled="!editEnabled">
    <template #character>
      <MdiStar v-if="ratingMeta.icon.full === 'mdi-star'" class="text-sm" />
      <MdiHeart v-if="ratingMeta.icon.full === 'mdi-heart'" class="text-sm" />
      <MdiMoonFull v-if="ratingMeta.icon.full === 'mdi-moon-full'" class="text-sm" />
      <MdiThumbUp v-if="ratingMeta.icon.full === 'mdi-thumb-up'" class="text-sm" />
      <MdiFlag v-if="ratingMeta.icon.full === 'mdi-flag'" class="text-sm" />
    </template>
  </a-rate>
</template>
