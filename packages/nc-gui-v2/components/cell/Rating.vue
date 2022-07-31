<script setup lang="ts">
import { computed, inject } from '#imports'
import { ColumnInj } from '~/context'
import MdiStarIcon from '~icons/mdi/star'
import MdiHeartIcon from '~icons/mdi/heart'
import MdiMoonFullIcon from '~icons/mdi/moon-full'
import MdiThumbUpIcon from '~icons/mdi/thumb-up'
import MdiFlagIcon from '~icons/mdi/flag'

interface Props {
  modelValue?: string | number
  readOnly?: boolean
}

const { modelValue: value, readOnly } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const ratingMeta = computed(() => {
  return {
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
    ...(column?.meta || {}),
  }
})
const localState = computed({
  get: () => value,
  set: (val: any) => emit('update:modelValue', val),
})
</script>

<template>
  <a-rate v-model:value="localState" :count="ratingMeta.max" :style="`color: ${ratingMeta.color}`">
    <template #character>
      <MdiStarIcon v-if="ratingMeta.icon.full === 'mdi-star'" class="text-sm" />
      <MdiHeartIcon v-if="ratingMeta.icon.full === 'mdi-heart'" class="text-sm" />
      <MdiMoonFullIcon v-if="ratingMeta.icon.full === 'mdi-moon-full'" class="text-sm" />
      <MdiThumbUpIcon v-if="ratingMeta.icon.full === 'mdi-thumb-up'" class="text-sm" />
      <MdiFlagIcon v-if="ratingMeta.icon.full === 'mdi-flag'" class="text-sm" />
    </template>
  </a-rate>
</template>

<style scoped></style>
