<script setup lang="ts">
import { computed, inject } from '#imports'
import { ColumnInj } from '~/components'

interface Props {
  modelValue: boolean
}

const { modelValue: value } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])
const column = inject(ColumnInj)
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
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})

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
