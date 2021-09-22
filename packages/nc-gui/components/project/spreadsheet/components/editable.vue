<template>
  <div
    ref="editable"
    contenteditable
    v-on="listeners"
  />
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      default: ''
    }
  },
  computed: {
    listeners() {
      return { ...this.$listeners, input: this.onInput }
    }
  },
  mounted() {
    this.$refs.editable.innerText = this.value
  },
  methods: {
    onInput(e) {
      this.$emit('input', e.target.innerText)
    }
  }
}
</script>
