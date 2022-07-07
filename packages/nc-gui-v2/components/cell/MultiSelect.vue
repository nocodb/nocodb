<script lang="ts" setup>
import { computed } from '@vue/reactivity'
import type { ColumnType } from 'nocodb-sdk'
import { Ref, inject } from 'vue'
import { enumColor } from '~/utils/colorsUtils'

const { modelValue } = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])
const column = inject<ColumnType>('column')
const isForm = inject<boolean>('isForm')
const editEnabled = inject<boolean>('editEnabled')

const options = computed<string[]>(() => {
  return column?.dtxp?.split(',').map((v) => v.replace(/\\'/g, "'").replace(/^'|'$/g, '')) || []
})

const localState = computed({
  get() {
    return modelValue?.match(/(?:[^',]|\\')+(?='?(?:,|$))/g).map((v: string) => v.replace(/\\'/g, "'"))
  },
  set(val) {
    emit('update:modelValue', val.filter((v: string) => options.value.includes(v)).join(','))
  },
})

/* import colors from '@/components/project/spreadsheet/helpers/colors'

export default {
  name: 'SetListCheckboxCell',
  props: {
    value: String,
    column: Object,
    values: Array,
  },
  data() {},
  computed: {
    colors() {
      return this.$store.state.settings.darkTheme ? colors.dark : colors.light
    },
    localState: {
      get() {
        return (this.value && this.value.split(',')) || []
      },
      set(val) {
        this.$emit('input', val.join(','))
        this.$emit('update')
      },
    },
    setValues() {
      if (this.column && this.column.dtxp) {
        return this.column.dtxp.split(',').map((v) => v.replace(/^'|'$/g, ''))
      }
      return this.values || []
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    },
  },
  mounted() {
    this.$el.focus()
    const event = document.createEvent('MouseEvents')
    event.initMouseEvent('mousedown', true, true, window)
    this.$el.dispatchEvent(event)
  },
} */
</script>

<template>
  <!--
  <v-select
    v-model="localState"
    :items="options"
    hide-details
    :clearable="!column.rqd"
    variation="outlined"
    multiple
  />
-->

  <v-combobox
    v-model="localState"
    :items="options"
    multiple
    chips
    flat
    dense
    solo
    hide-details
    deletable-chips
    class="text-center mt-0"
  >
    <!--    <template #selection="data"> -->
    <!--      <v-chip -->
    <!--        :key="data.item" -->
    <!--        small -->
    <!--        class="ma-1 " -->
    <!--        :color="colors[setValues.indexOf(data.item) % colors.length]" -->
    <!--        @click:close="data.parent.selectItem(data.item)" -->
    <!--      > -->
    <!--        {{ data.item }} -->
    <!--      </v-chip> -->
    <!--    </template> -->

    <!--    <template #item="{item}"> -->
    <!--      <v-chip small :color="colors[setValues.indexOf(item) % colors.length]"> -->
    <!--        {{ item }} -->
    <!--      </v-chip> -->
    <!--    </template> -->
    <!--    <template #append> -->
    <!--      <v-icon small class="mt-2"> -->
    <!--        mdi-menu-down -->
    <!--      </v-icon> -->
    <!--    </template> -->
  </v-combobox>
</template>

<style scoped></style>
