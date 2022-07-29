<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import { isVirtualCol } from 'nocodb-sdk'
import { computed } from 'vue'
import { MetaInj } from '~/context'
import VirtualCellIcon from '~/components/smartsheet-header/VirtualCellIcon.vue'
import CellIcon from '~/components/smartsheet-header/CellIcon.vue'

interface Props {
  modelValue?: string
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const meta = inject(MetaInj)

const localValue = computed({
  get: () => modelValue,
  set: (val) => emit('update:modelValue', val),
})

/* export default {
  name: 'FieldListAutoCompleteDropdown',
  props: {
    columns: Array,
    value: String,
  },
  computed: {
    localValue: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      },
    },
  },
  mounted() {
    const autocompleteInput = this.$refs.field.$refs.input
    autocompleteInput.addEventListener('focus', this.onFocus, true)
  },
  methods: {
    onFocus(e) {
      this.$refs.field.isMenuActive = true // open item list
    },
  },
} */
const options = computed<SelectProps['options']>(() =>
  meta?.value?.columns?.map((c) => ({
    value: c.id,
    label: c.title,
    icon: h(isVirtualCol(c) ? VirtualCellIcon : CellIcon, {
      columnMeta: c,
    }),
    c,
  })),
)

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase()?.includes(input.toLowerCase())
}
</script>

<template>
  <a-select v-model:value="localValue" size="small" show-search placeholder="Select a field" :filter-option="filterOption">
    <a-select-option v-for="option in options" :key="option.value" :value="option.value">
      <div class="flex gap-2 align-center"><component :is="option.icon" class="!text-xs !mx-0" /> {{ option.label }}</div>
    </a-select-option>
  </a-select>
</template>
