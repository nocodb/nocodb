<script setup lang="ts">
import { computed, inject } from '#imports'
import { ColumnInj, IsFormInj } from '~/context'
import MdiStarIcon from '~icons/mdi/star'
import MdiStarOutlineIcon from '~icons/mdi/star-outline'

interface Props {
  modelValue?: string | number
  readOnly?: boolean
}

const { modelValue: value, readOnly } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])
const column = inject(ColumnInj)
const isForm = inject(IsFormInj)

const ratingMeta = computed(() => {
  return {
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
    // ...(column?.meta || {})
  }
})
const localState = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <div class="d-100 h-100" :class="{ 'nc-cell-hover-show': localState === 0 || !localState }">
    <v-rating v-model="localState" :length="ratingMeta.max" dense x-small :readonly="readOnly" clearable>
      <!--      todo:  use the proper slot -->
      <template #item="{ isFilled, click }">
        <!--        todo : custom icon -->
        <MdiStarIcon v-if="isFilled" :style="`color: ${ratingMeta.color}`" @click="click" />
        <MdiStarOutlineIcon v-else :style="`color: ${ratingMeta.color}`" @click="click" />
      </template>
    </v-rating>
  </div>
</template>

<style scoped></style>
