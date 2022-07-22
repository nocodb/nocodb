<script setup lang="ts">
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
</script>

<template>
  <v-autocomplete
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
    <!--    &lt;!&ndash; @change="$emit('change')" &ndash;&gt; -->
    <!--    <template #selection="{ item }"> -->
    <!--      <v-icon small class="mr-1"> -->
    <!--        {{ item.icon }} -->
    <!--      </v-icon> -->
    <!--      {{ item.title }} -->
    <!--    </template> -->
    <!--    <template #item="{ item }"> -->
    <!--      <span :class="`caption font-weight-regular nc-fld-${item.title}`"> -->
    <!--        <v-icon color="grey" small class="mr-1"> -->
    <!--          {{ item.icon }} -->
    <!--        </v-icon> -->
    <!--        {{ item.title }} -->
    <!--      </span> -->
    <!--    </template> -->
  </v-autocomplete>
</template>

<style scoped></style>
