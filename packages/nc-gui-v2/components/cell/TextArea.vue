<script setup lang="ts">
import { inject, ref, useVModel } from '#imports'
import { EditModeInj } from '~/context'

interface Props {
  modelValue?: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj, ref(false))

const vModel = useVModel(props, 'modelValue', emit)

const focus = (el: HTMLTextAreaElement) => el.focus()
</script>

<template>
  <textarea v-if="editEnabled" :ref="focus" v-model="vModel" rows="4" @keydown.alt.enter.stop @keydown.shift.enter.stop />
  <span v-else>{{ vModel }}</span>
</template>

<style scoped>
input,
textarea {
  width: 100%;
  min-height: 60px;
  height: 100%;
  color: var(--v-textColor-base);
}
</style>
