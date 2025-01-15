<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import isMobilePhone from 'validator/lib/isMobilePhone'

interface Props {
  modelValue: string | null | number | undefined
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const rowHeight = inject(RowHeightInj, ref(undefined))

const { showNull } = useGlobal()

const { t } = useI18n()

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const column = inject(ColumnInj)!

const isForm = inject(IsFormInj)!

const readOnly = inject(ReadonlyInj, ref(false))

// Used in the logic of when to display error since we are not storing the phone if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isMobilePhone(val)) || !val || isForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const validPhoneNumber = computed(() => vModel.value && isMobilePhone(vModel.value))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

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
  <!-- eslint-disable vue/use-v-on-exact -->
  <input
    v-if="!readOnly && editEnabled"
    :ref="focus"
    v-model="vModel"
    class="nc-cell-field w-full outline-none py-1"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.alt.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

  <a
    v-else-if="validPhoneNumber"
    class="py-1 underline inline-block nc-cell-field-link"
    :href="`tel:${vModel}`"
    target="_blank"
    rel="noopener noreferrer"
    :tabindex="readOnly ? -1 : 0"
  >
    <LazyCellClampedText :value="vModel" :lines="rowHeight" class="nc-cell-field" />
  </a>

  <LazyCellClampedText v-else :value="vModel" :lines="rowHeight" class="nc-cell-field" />
</template>
