<template>
  <input v-model="localState" v-on="parentListeners">
</template>

<script>
import { isValidURL } from '@/helpers'

export default {
  name: 'EditableUrlCell',
  props: {
    value: String
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        console.log(isValidURL(val))
        if (isValidURL(val)) { this.$emit('input', val) }
      }
    },
    parentListeners() {
      const $listeners = {}

      if (this.$listeners.blur) {
        $listeners.blur = this.$listeners.blur
      }
      if (this.$listeners.focus) {
        $listeners.focus = this.$listeners.focus
      }

      if (this.$listeners.cancel) {
        $listeners.cancel = this.$listeners.cancel
      }

      return $listeners
    }
  },
  mounted() {
    this.$el.focus()
  }
}
</script>

<style scoped>
input, textarea {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
}
</style>
