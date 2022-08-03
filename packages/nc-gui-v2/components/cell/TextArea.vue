<script setup lang="ts">
import { inject, ref, useVModel } from '#imports'
import { EditModeInj } from '~/context'

interface Props {
  modelValue: string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const focus = (el: HTMLTextAreaElement) => el?.focus()
</script>

<template>
  <textarea
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    rows="4"
    class="h-full w-full min-h-[60px] outline-none"
    @blur="editEnabled = false"
    @keydown.alt.enter.stop
    @keydown.shift.enter.stop
  />
  <span v-else>{{ vModel }}</span>
</template>
