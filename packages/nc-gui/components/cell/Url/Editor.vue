<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const column = inject(ColumnInj)!
const editEnabled = inject(EditModeInj, ref(false))
const isEditColumn = inject(EditColumnInj, ref(false))
const readOnly = inject(ReadonlyInj, ref(false))
const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!
const isForm = inject(IsFormInj)!
const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const trim = (val: string) => val?.trim?.()

// Used in the logic of when to display error since we are not storing the url if it's not valid
const localState = ref(props.modelValue)
const inputRef = ref<HTMLInputElement>()
const isFocused = ref(false)

const vModel = computed({
  get: () => props.modelValue,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isValidURL(trim(val))) || !val || isForm.value || isEditColumn.value) {
      emit('update:modelValue', val)
    }
  },
})

const url = computed(() => {
  if (!vModel.value) return ''

  const updatedValue = addMissingUrlSchma(vModel.value ?? '')

  if (!isValidURL(updatedValue)) return ''

  return updatedValue
})

const focus: VNodeRef = (el) => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value = el as HTMLInputElement
    inputRef.value?.focus()
  }
}

onBeforeUnmount(() => {
  if (
    !isForm.value &&
    parseProp(column.value.meta)?.validate &&
    (!editEnabled.value || isCanvasInjected) &&
    localState.value &&
    !isValidURL(trim(localState.value))
  ) {
    if (!isEditColumn.value) {
      message.error(t('msg.error.invalidURL'))
    }

    localState.value = undefined
    return
  }
  localState.value = props.modelValue
})

onMounted(() => {
  if (!isExpandedFormOpen.value && !isEditColumn.value && !isForm.value) {
    inputRef.value?.focus()
  }
})

const onBlur = () => {
  editEnabled.value = false
  isFocused.value = false
}

const showClicableLink = computed(() => {
  return (isExpandedFormOpen.value || isForm.value) && !isFocused.value && url.value
})
</script>

<template>
  <div class="flex flex-row items-center justify-between w-full h-full">
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field outline-none w-full py-1 bg-transparent h-full"
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
    />
    <div
      v-if="showClicableLink"
      class="nc-cell-field nc-cell-link-preview absolute inset-0 flex items-center max-w-full overflow-hidden pointer-events-none"
    >
      <a
        class="truncate text-primary cursor-pointer pointer-events-auto no-user-select"
        :href="url"
        @click.prevent="confirmPageLeavingRedirect(url)"
      >
        {{ vModel }}
      </a>
    </div>
  </div>
</template>
