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

const focus = (el: HTMLInputElement) => el?.focus()
</script>

<template>
  <input v-if="editEnabled" :ref="focus" v-model="vModel" class="h-full w-full outline-none" @blur="editEnabled = false" />
  <span v-else>{{ vModel }}</span>
</template>
