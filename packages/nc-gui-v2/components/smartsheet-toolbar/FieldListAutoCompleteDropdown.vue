<script setup lang="ts">
import type { SelectProps } from 'ant-design-vue'
import { computed } from 'vue'
import { MetaInj } from '~/context'

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
  })),
)

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase()?.includes(input.toLowerCase())
}
</script>

<template>
  <a-select
    v-model:value="localValue"
    size="small"
    show-search
    placeholder="Select a field"
    :options="options"
    :filter-option="filterOption"
  ></a-select>

  <!--  <v-autocomplete
      ref="field"
      v-model="localValue"
      class="caption"
      :items="meta.columns"
      item-value="id"
      item-text="title"
      :label="$t('objects.field')"
      variant="solo"
      hide-details
      @click.stop
    >
      &lt;!&ndash;    &lt;!&ndash; @change="$emit('change')" &ndash;&gt; &ndash;&gt;
      &lt;!&ndash;    <template #selection="{ item }"> &ndash;&gt;
      &lt;!&ndash;      <v-icon small class="mr-1"> &ndash;&gt;
      &lt;!&ndash;        {{ item.icon }} &ndash;&gt;
      &lt;!&ndash;      </v-icon> &ndash;&gt;
      &lt;!&ndash;      {{ item.title }} &ndash;&gt;
      &lt;!&ndash;    </template> &ndash;&gt;
      &lt;!&ndash;    <template #item="{ item }"> &ndash;&gt;
      &lt;!&ndash;      <span :class="`caption font-weight-regular nc-fld-${item.title}`"> &ndash;&gt;
      &lt;!&ndash;        <v-icon color="grey" small class="mr-1"> &ndash;&gt;
      &lt;!&ndash;          {{ item.icon }} &ndash;&gt;
      &lt;!&ndash;        </v-icon> &ndash;&gt;
      &lt;!&ndash;        {{ item.title }} &ndash;&gt;
      &lt;!&ndash;      </span> &ndash;&gt;
      &lt;!&ndash;    </template> &ndash;&gt;
    </v-autocomplete> -->
</template>

