<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { extractEmail } from '~/helpers/parsers/parserHelpers'

interface Props {
  modelValue: string | null | undefined
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const editEnabled = inject(EditModeInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const column = inject(ColumnInj)!
const isEditColumn = inject(EditColumnInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isForm = inject(IsFormInj)!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const localState = ref(props.modelValue)
const inputRef = ref<HTMLInputElement>()
const isFocused = ref(false)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && validateEmail(val)) || !val || isForm.value || isEditColumn.value) {
      emit('update:modelValue', val)
    }
  },
})

const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value = el as HTMLInputElement
    inputRef.value?.focus()
  }
}

const onPaste = (e: ClipboardEvent) => {
  const pastedText = e.clipboardData?.getData('text') ?? ''
  if (parseProp(column.value.meta).validate) {
    vModel.value = extractEmail(pastedText) || pastedText
  } else {
    vModel.value = pastedText
  }
}

onBeforeUnmount(() => {
  if (
    !isForm.value &&
    parseProp(column.value.meta)?.validate &&
    (!editEnabled.value || isCanvasInjected) &&
    localState.value &&
    !validateEmail(localState.value)
  ) {
    if (!isEditColumn.value) {
      message.error(t('msg.error.invalidEmail'))
    }

    localState.value = undefined
    return
  }
  localState.value = props.modelValue
})

onMounted(() => {
  if (isCanvasInjected && !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && !isUnderLookup.value) {
    inputRef.value?.focus()
  }
})

const onBlur = () => {
  editEnabled.value = false
  isFocused.value = false
}

const validEmail = computed(() => vModel.value && validateEmail(vModel.value))

const showClicableLink = computed(() => {
  return (isExpandedFormOpen.value || isForm.value) && !isFocused.value && validEmail.value
})
</script>

<template>
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-bind="$attrs"
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field w-full outline-none py-1"
    :class="{
      'nc-text-transparent': showClicableLink,
    }"
    :disabled="readOnly"
    @blur="onBlur"
    @focus="isFocused = true"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
    @paste.prevent="onPaste"
  />
  <div
    v-if="showClicableLink"
    class="nc-cell-field nc-cell-link-preview absolute inset-0 flex items-center max-w-full overflow-hidden pointer-events-none"
  >
    <nuxt-link
      no-ref
      class="truncate text-primary cursor-pointer pointer-events-auto no-user-select"
      :href="`mailto:${vModel}`"
      target="_blank"
      :tabindex="-1"
    >
      {{ vModel }}
    </nuxt-link>
  </div>
</template>
