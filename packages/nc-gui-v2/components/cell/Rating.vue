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
  <div class="text-sm" :class="{ 'nc-cell-hover-show': localState === 0 || !localState }">
    <a-rate v-model:value="localState" :count="ratingMeta.max" :style="`color: ${ratingMeta.color}`">
      <template #character>
        <MdiStarIcon v-if="ratingMeta.icon.full === 'mdi-star'" />
        <MdiHeartIcon v-if="ratingMeta.icon.full === 'mdi-heart'" />
        <MdiMoonFullIcon v-if="ratingMeta.icon.full === 'mdi-moon-full'" />
        <MdiThumbUpIcon v-if="ratingMeta.icon.full === 'mdi-thumb-up'" />
        <MdiFlagIcon v-if="ratingMeta.icon.full === 'mdi-flag'" />
      </template>
    </a-rate>
  </div>
</template>

<style scoped></style>
