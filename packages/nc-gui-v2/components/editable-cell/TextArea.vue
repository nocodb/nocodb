<script setup lang="ts">
import { computed } from '@vue/reactivity'
import { onMounted } from 'vue'

const { modelValue: value } = defineProps<{ modelValue: any }>()

const emit = defineEmits(['update:modelValue'])

const root = ref<HTMLInputElement>()

const localState = computed({
  get() {
    return value
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

onMounted(() => {
  root.value?.focus()
})
/* export default {
  name: 'TextAreaCell',
  props: {
    value: String,
  },
  computed: {
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

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      return $listeners
    },
  },
  created() {
    this.localState = this.value
  },
  mounted() {
    this.$refs.textarea && this.$refs.textarea.focus()
  },
} */
</script>

<template>
  <textarea ref="root" v-model="localState" rows="4" v-on="parentListeners" @keydown.alt.enter.stop @keydown.shift.enter.stop />
</template>

<style scoped>
input,
textarea {
  width: 100%;
  min-height: 60px;
  height: 100%;
  color: var(--v-textColor-base);
}
</style>
