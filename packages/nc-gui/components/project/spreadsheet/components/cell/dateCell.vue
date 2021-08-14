<template>
  <span>{{ date }}</span>
</template>

<script>
export default {
  name: 'DateCell',
  props: ['value'],
  computed: {
    date() {
      return typeof this.value === 'string' ? this.value.replace(/(\d)T(?=\d)/, '$1 ').replace(/\s\d{2}:\d{2}:[\d:.]+z?$/i, '') : (this.value && new Date(this.value))
    }
  }
}
</script>

<style scoped>

</style>
