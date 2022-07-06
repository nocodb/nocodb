<script>


import { computed } from "@vue/reactivity";
import { ColumnType } from "nocodb-sdk";
import { inject, Ref } from "vue";
import {enumColor}from "~/utils/colorsUtils";

const column = inject<ColumnType>("column");
const isForm = inject<boolean>("isForm");

const { modelValue } = defineProps<{ modelValue: any }>();
const emit = defineEmits(["update:modelValue"]);

const localState = computed({
  get() {
    return modelValue?.replace(/\\'/g, "'").replace(/^'|'$/g, "");
  },
  set(val) {
    emit("update:modelValue", val);
  }
});

const options = computed<string[]>(() => {
  return column?.dtxp?.split(",").map((v) => v.replace(/\\'/g, "'").replace(/^'|'$/g, "")) || [];
});

/*import colors from '@/components/project/spreadsheet/helpers/colors'

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
}*/
</script>

<template>
  <div class="d-flex align-center">
    <div>
      <div v-for="(val, i) of setValues" :key="val" class="">
        <input :id="`key-check-box-${val}`" v-model="localState" type="checkbox" class="orange--text" :value="val" />
        <label
          class="py-1 px-3 d-inline-block my-1 label"
          :for="`key-check-box-${val}`"
          :style="{
            background: colors[i % colors.length],
          }"
          >{{ val }}</label
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.label {
  border-radius: 25px;
}
</style>
