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
  watch: {
    value(v) {
      if (this.$refs.editable.innerText !== v) {
        this.$refs.editable.innerText = v
      }
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
<style scoped>
[contentEditable] {
  position: relative;
}

[contentEditable]:empty:before {
  position: absolute;
  left: 4px;
  right: 4px;
  content: attr(placeholder);
  color: grey;
  font-style: italic;
  width: 100%;
}
</style>
