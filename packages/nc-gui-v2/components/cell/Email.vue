<script lang="ts" setup>
import { computed, inject, useVModel } from '#imports'
import { isEmail } from '~/utils'
import { EditModeInj } from '~/context'

interface Props {
  modelValue: string
}

interface Emits {
  (event: 'update:modelValue', model: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const editEnabled = inject(EditModeInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const validEmail = computed(() => isEmail(vModel.value))

const focus = (el: HTMLInputElement) => el.focus()
</script>

<template>
  <input v-if="editEnabled" ref="root" v-model="vModel" class="outline-none prose-sm" />
  <a v-else-if="validEmail" class="prose-sm underline hover:opacity-75" :href="`mailto:${vModel}`" target="_blank">
    {{ vModel }}
  </a>
  <span v-else>{{ vModel }}</span>
</template>
