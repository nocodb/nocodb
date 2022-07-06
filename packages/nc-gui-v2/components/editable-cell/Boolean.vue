<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { computed } from 'vue'

const { modelValue: value } = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])
const column = inject<ColumnType & { meta?: any }>('column')
const isForm = inject<boolean>('isForm')

const checkboxMeta = computed(() => {
  return {
    icon: {
      checked: 'mdi-check-circle-outline',
      unchecked: 'mdi-checkbox-blank-circle-outline',
    },
    color: 'primary',
    ...(column?.meta || {}),
  }
})
const localState = computed({
  get() {
    return value
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

const toggle = () => {
  localState.value = !localState.value
}

// const checkedIcon = computed(() => {
//   return defineAsyncComponent( ()=>import('~icons/material-symbols/'+checkboxMeta?.value?.icon?.checked))
// });
// const uncheckedIcon = computed(() => {
//   return defineAsyncComponent(()=>import('~icons/material-symbols/'+checkboxMeta?.value?.icon?.unchecked))
// });

/* export default {
  name: 'BooleanCell',
  props: {
    column: Object,
    value: [String, Number, Boolean],
    isForm: Boolean,
    readOnly: Boolean,
  },
  computed: {
    checkedIcon() {
      return (this.checkboxMeta && this.checkboxMeta.icon && this.checkboxMeta.icon.checked) || 'mdi-check-bold'
    },
    uncheckedIcon() {
      return (this.checkboxMeta && this.checkboxMeta.icon && this.checkboxMeta.icon.unchecked) || 'mdi-crop-square'
    },
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      },
    },
    parentListeners() {
      const $listeners = {}
      return $listeners
    },
    checkboxMeta() {
      return {
        icon: {
          checked: 'mdi-check-circle-outline',
          unchecked: 'mdi-checkbox-blank-circle-outline',
        },
        color: 'primary',
        ...(this.column && this.column.meta ? this.column.meta : {}),
      }
    },
  },
  methods: {
    toggle() {
      this.localState = !this.localState
    },
  },
} */
</script>

<template>
  <div class="d-flex align-center" :class="{ 'justify-center': !isForm, 'nc-cell-hover-show': !localState }">
    <!--    <span :is="localState ? checkedIcon : uncheckedIcon" small :color="checkboxMeta.color" @click="toggle"> -->
    <!--      {{ localState ? checkedIcon : uncheckedIcon }} -->
    <!--    </span> -->

    <input v-model="localState" type="checkbox" />
  </div>
</template>
