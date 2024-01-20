<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import {
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  IsFormInj,
  IsSurveyFormInj,
  ReadonlyInj,
  computed,
  inject,
  useI18n,
  validateEmail,
} from '#imports'

interface Props {
  modelValue: string | null | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const rowHeight = inject(RowHeightInj, ref(undefined))

const { t } = useI18n()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj)!

const column = inject(ColumnInj)!

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

// Used in the logic of when to display error since we are not storing the email if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && validateEmail(val)) || !val || isSurveyForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const validEmail = computed(() => vModel.value && validateEmail(vModel.value))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

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
    v-if="!readOnly && editEnabled"
    :ref="focus"
    v-model="vModel"
    class="w-full outline-none text-sm py-1"
    :class="isExpandedFormOpen ? 'px-2' : 'px-0'"
    :placeholder="isEditColumn ? $t('labels.optional') : ''"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-null uppercase" :class="isExpandedFormOpen ? 'px-2' : 'px-0'">{{
    $t('general.null')
  }}</span>

  <nuxt-link
    v-else-if="validEmail"
    no-ref
    class="py-1 text-sm underline hover:opacity-75 inline-block"
    :href="`mailto:${vModel}`"
    target="_blank"
    :tabindex="readOnly ? -1 : 0"
  >
    <LazyCellClampedText :value="vModel" :lines="rowHeight" :class="isExpandedFormOpen ? 'px-2' : 'px-0'" />
  </nuxt-link>

  <LazyCellClampedText v-else :value="vModel" :lines="rowHeight" :class="isExpandedFormOpen ? 'px-2' : 'px-0'" />
</template>
