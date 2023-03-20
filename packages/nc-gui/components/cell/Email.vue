<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, computed, inject, useI18n, validateEmail } from '#imports'

interface Props {
  modelValue: string | null | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj)!

const column = inject(ColumnInj)!

// Used in the logic of when to display error since we are not storing the email if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && validateEmail(val)) || !val) {
      emit('update:modelValue', val)
    }
  },
})

const validEmail = computed(() => vModel.value && validateEmail(vModel.value))

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

watch(
  () => editEnabled.value,
  () => {
    if (parseProp(column.value.meta)?.validate && !editEnabled.value && localState.value && !validateEmail(localState.value)) {
      message.error(t('msg.error.invalidEmail'))
      localState.value = undefined
      return
    }
    localState.value = value
  },
)
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="w-full outline-none text-sm px-2"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>

  <a v-else-if="validEmail" class="text-sm underline hover:opacity-75" :href="`mailto:${vModel}`" target="_blank">
    {{ vModel }}
  </a>

  <span v-else>{{ vModel }}</span>
</template>
