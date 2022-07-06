<script>
export default {
  name: 'TimeCell',
  props: ['value'],
  computed: {
    time() {
      return typeof this.value === 'string' ? this.value.replace(/(\d)T(?=\d)/, '$1 ') : this.value
    },
  },
}
</script>

<template>
  <span>{{ time }}</span>
</template>

<style scoped></style>
