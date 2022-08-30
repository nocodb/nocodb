<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { computed } from 'vue'
import { MetaInj } from '~/context'
import VirtualCellIcon from '~/components/smartsheet-header/VirtualCellIcon.vue'
import CellIcon from '~/components/smartsheet-header/CellIcon.vue'

interface Props {
  modelValue?: string
  isSort?: boolean
}

const { modelValue, isSort } = defineProps<Props>()

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
  meta?.value?.columns
    ?.filter((c: ColumnType) => {
      /** ignore hasmany and manytomany relations if it's using within sort menu */
      if (isSort) {
        return !(
          c.uidt === UITypes.LinkToAnotherRecord && (c.colOptions as LinkToAnotherRecordType).type !== RelationTypes.BELONGS_TO
        )
        /** ignore vutual fields which are system fields ( mm relation ) */
      } else {
        return !c.colOptions || !c.system
      }
    })
    .map((c: ColumnType) => ({
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
  <a-select
    v-model:value="localValue"
    :dropdown-match-select-width="false"
    show-search
    placeholder="Select a field"
    :filter-option="filterOption"
  >
    <a-select-option v-for="option in options" :key="option.value" :value="option.value">
      <div class="flex gap-2 items-center items-center h-full">
        <component :is="option.icon" class="min-w-5 !mx-0" />
        <span class="min-w-0"> {{ option.label }}</span>
      </div>
    </a-select-option>
  </a-select>
</template>
