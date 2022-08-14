<script setup lang="ts">
import { ColumnInj, computed, getPercentStep, inject, isValidPercent, renderPercent } from '#imports'
import { EditModeInj } from '~/context'

interface Props {
  modelValue: number | string | null | undefined
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const column = inject(ColumnInj)

const percent = ref()

const isEdited = ref(false)

const percentType = computed(() => column?.value?.meta?.precision || 0)

const percentStep = computed(() => getPercentStep(percentType.value))

const localState = computed({
  get: () => {
    return renderPercent(modelValue, percentType.value, !isEdited.value)
  },
  set: (val) => {
    if (val === null) val = 0
    if (isValidPercent(val, column?.value?.meta?.negative)) {
      percent.value = val / 100
    }
  },
})

function onKeyDown(evt: KeyboardEvent) {
  isEdited.value = true
  return ['e', 'E', '+', '-'].includes(evt.key) && evt.preventDefault()
}

function onBlur() {
  if (isEdited.value) {
    emit('update:modelValue', percent.value)
    isEdited.value = false
  }
}

function onKeyDownEnter() {
  if (isEdited.value) {
    emit('update:modelValue', percent.value)
    isEdited.value = false
  }
}
</script>

<template>
  <input
    v-if="isEdited"
    v-model="localState"
    type="number"
    :step="percentStep"
    @keydown="onKeyDown"
    @blur="onBlur"
    @keydown.enter="onKeyDownEnter"
  />
  <input v-if="editEnabled" v-model="localState" type="text" @focus="isEdited = true" />
  <span v-else>{{ localState }}</span>
</template>
