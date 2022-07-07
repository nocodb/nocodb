<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { computed, inject } from 'vue'
import { ColumnInj } from '~/components'
import MdiStarIcon from '~icons/mdi/star'
import MdiStarOutlineIcon from '~icons/mdi/star-outline'

const { modelValue: value } = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])
const column = inject(ColumnInj)
const isForm = inject<boolean>('isForm')

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
  get() {
    return value
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

const toggle = () => {
  localState.value = !localState.value
}
/* import { inject } from "vue";

const editEnabled = inject<boolean>("editEnabled");

export default {
  name: 'RatingCell',
  props: {
    column: Object,
    value: [String, Number],
    readOnly: Boolean,
  },
  computed: {
    fullIcon() {
      return (this.ratingMeta && this.ratingMeta.icon && this.ratingMeta.icon.full) || 'mdi-star'
    },
    emptyIcon() {
      return (this.ratingMeta && this.ratingMeta.icon && this.ratingMeta.icon.empty) || 'mdi-star-outline'
    },
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      },
    },
    ratingMeta() {
      return {
        icon: {
          full: 'mdi-star',
          empty: 'mdi-star-outline',
        },
        color: '#fcb401',
        max: 5,
        ...(this.column && this.column.meta ? this.column.meta : {}),
      }
    },
  },
} */
</script>

<template>
  <div class="d-100 h-100" :class="{ 'nc-cell-hover-show': localState == 0 || !localState }">
    <v-rating v-model="localState" :length="ratingMeta.max" dense x-small :readonly="readOnly" clearable>
      <template #item="{ isFilled, click }">
        <v-icon v-if="isFilled" :size="15" :color="ratingMeta.color" @click="click">
          <MdiStarIcon />
          <!--          {{ fullIcon }} -->
        </v-icon>
        <v-icon v-else :color="ratingMeta.color" :size="15" class="nc-cell-hover-show" @click="click">
          <!--          {{ emptyIcon }} -->
          <MdiStarOutlineIcon />
        </v-icon>
      </template>
    </v-rating>
  </div>
</template>

<style scoped></style>
