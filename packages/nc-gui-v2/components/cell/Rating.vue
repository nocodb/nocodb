<script setup lang="ts">
import { computed, inject } from '#imports'
import { ColumnInj, IsFormInj } from '~/context'
import MdiStarIcon from '~icons/mdi/star'
import MdiStarOutlineIcon from '~icons/mdi/star-outline'

interface Props {
  modelValue?: number
  readOnly?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const column = inject(ColumnInj)
const isForm = inject(IsFormInj)
</script>

<template>
  <div class="d-100 h-100" :class="{ 'nc-cell-hover-show': vModel === 0 || !vModel }">
    <v-rating v-model="vModel" :length="5" dense x-small :readonly="readOnly" clearable>
      <template #item="{ isFilled, click }">
        <MdiStarIcon v-if="isFilled" class="text-[#fcb40]" @click="click" />
        <MdiStarOutlineIcon v-else class="text-[#fcb40]" @click="click" />
      </template>
    </v-rating>
  </div>
</template>
