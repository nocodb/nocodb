<script lang="ts" setup>
import { isValidPhoneNumber } from 'nocodb-sdk'

interface Props {
  modelValue: string | null | number | undefined
}

const props = defineProps<Props>()

const rowHeight = inject(RowHeightInj, ref(undefined))

const readOnly = inject(ReadonlyInj, ref(false))

const validPhoneNumber = computed(() => props.modelValue && isValidPhoneNumber(props.modelValue))
</script>

<template>
  <a
    v-if="validPhoneNumber"
    class="py-1 underline inline-block nc-cell-field-link"
    :href="`tel:${modelValue}`"
    target="_blank"
    rel="noopener noreferrer"
    :tabindex="readOnly ? -1 : 0"
  >
    <LazyCellClampedText :value="modelValue" :lines="rowHeight" class="nc-cell-field" />
  </a>

  <LazyCellClampedText v-else :value="modelValue" :lines="rowHeight" class="nc-cell-field" />
</template>
