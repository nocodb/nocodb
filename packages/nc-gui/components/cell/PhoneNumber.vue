<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import isMobilePhone from 'validator/lib/isMobilePhone'
import { EditColumnInj, EditModeInj, IsExpandedFormOpenInj, IsSurveyFormInj, computed, inject } from '#imports'

interface Props {
  modelValue: string | null | number | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const rowHeight = inject(RowHeightInj, ref(undefined))

const { showNull } = useGlobal()

const { t } = useI18n()

const editEnabled = inject(EditModeInj)!

const isEditColumn = inject(EditColumnInj, ref(false))

const column = inject(ColumnInj)!

// Used in the logic of when to display error since we are not storing the phone if it's not valid
const localState = ref(value)

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isMobilePhone(val)) || !val || isSurveyForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const validEmail = computed(() => vModel.value && isMobilePhone(vModel.value))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && !isEditColumn.value && (el as HTMLInputElement)?.focus()

watch(
  () => editEnabled.value,
  () => {
    if (parseProp(column.value.meta)?.validate && !editEnabled.value && localState.value && !isMobilePhone(localState.value)) {
      message.error(t('msg.invalidPhoneNumber'))
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
    class="w-full outline-none text-sm px-1 py-2"
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

  <span v-else-if="vModel === null && showNull" class="nc-null uppercase">{{ $t('general.null') }}</span>

  <a
    v-else-if="validEmail"
    class="text-sm underline hover:opacity-75"
    :href="`tel:${vModel}`"
    target="_blank"
    rel="noopener noreferrer"
  >
    <LazyCellClampedText :value="vModel" :lines="rowHeight" />
  </a>

  <LazyCellClampedText v-else :value="vModel" :lines="rowHeight" />
</template>
