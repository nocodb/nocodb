<script setup lang="ts">
import { computed, inject } from '#imports'
import { ColumnInj, IsFormInj } from "~/components";
import MdiStarIcon from '~icons/mdi/star'
import MdiStarOutlineIcon from '~icons/mdi/star-outline'

interface Props {
  modelValue: string | number
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
      <template #item="{ isFilled, click }">
        <!--        todo : custom color and icon -->
        <!--        <v-icon v-if="isFilled"- :size="15" :color="ratingMeta.color" @click="click"> -->
        <MdiStarIcon v-if="isFilled" @click="click" />
        <!--        </v-icon> -->
        <!--        <v-icon v-else :color="ratingMeta.color" :size="15" class="nc-cell-hover-show" @click="click"> -->
        <MdiStarOutlineIcon v-else @click="click" />
        <!--        </v-icon> -->
      </template>
    </v-rating>
  </div>
</template>

<style scoped></style>
