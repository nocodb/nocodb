<script setup lang="ts">
import { computed, inject, onMounted, ref } from '#imports'

interface Props {
  modelValue: string
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const editEnabled = inject<boolean>('editEnabled', false)

const root = ref<HTMLInputElement>()

const localState = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
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
  <textarea v-if="editEnabled" ref="root" v-model="localState" rows="4" @keydown.alt.enter.stop @keydown.shift.enter.stop />
  <span v-else>{{ localState }}</span>
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
