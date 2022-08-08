<script setup lang="ts">
import { computed, inject, useVModel } from '#imports'
import { ColumnInj } from '~/context'

interface Props {
  modelValue?: number | null
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: NaN,
})

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const ratingMeta = computed(() => {
  return {
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
    ...(column?.value?.meta || {}),
  }
})

const vModel = useVModel(props, 'modelValue', emits)
</script>

<template>
  <a-rate v-model:value="vModel" :count="ratingMeta.max" :style="`color: ${ratingMeta.color}`" :disabled="props.readOnly">
    <template #character>
      <MdiStar v-if="ratingMeta.icon.full === 'mdi-star'" class="text-sm" />
      <MdiHeart v-if="ratingMeta.icon.full === 'mdi-heart'" class="text-sm" />
      <MdiMoonFull v-if="ratingMeta.icon.full === 'mdi-moon-full'" class="text-sm" />
      <MdiThumbUp v-if="ratingMeta.icon.full === 'mdi-thumb-up'" class="text-sm" />
      <MdiFlag v-if="ratingMeta.icon.full === 'mdi-flag'" class="text-sm" />
    </template>
  </a-rate>
</template>
