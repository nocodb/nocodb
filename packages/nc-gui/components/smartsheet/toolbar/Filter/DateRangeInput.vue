<script setup lang="ts">
import { isDateMonthFormat } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import DatePicker from '~/components/cell/Date/index.vue'

// The `dateRange` sub-op's value: "from,to", one date picker per end.
interface Props {
  modelValue?: unknown
  column?: ColumnType
  disabled?: boolean
  readOnly?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void
  (event: 'focus'): void
  (event: 'blur'): void
}>()

const parts = computed(() => getDateRangeParts(props.modelValue))

const isMonthFormat = computed(() => isDateMonthFormat(parseProp(props.column?.meta)?.date_format))

function updatePart(index: 0 | 1, value: string | null) {
  emit('update:modelValue', setDateRangePart(props.modelValue, index, value, isMonthFormat.value))
}
</script>

<template>
  <DatePicker
    v-for="(part, index) in parts"
    :key="index"
    :model-value="part"
    :disabled="readOnly || disabled"
    :placeholder="$t('placeholder.enterAValue')"
    :column="column"
    class="flex !rounded-lg flex-1 min-w-0"
    :class="{
      'text-nc-content-gray-muted pointer-events-none': disabled,
    }"
    :show-readonly-field="readOnly || disabled"
    location="filter"
    @update:model-value="updatePart(index as 0 | 1, $event)"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>
