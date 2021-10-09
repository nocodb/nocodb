<template>
  <span>{{ dateTime }}</span>
</template>

<script>
export default {
  name: 'DateTimeCell',
  props: ['value'],
  computed: {
    dateTime() {
      if (/^\d{6,}$/.test(this.value)) {
        return new Date(+this.value)
      }

      return /\dT\d/.test(this.value) ? new Date(this.value.replace(/(\d)T(?=\d)/, '$1 ')) : ((this.value && new Date(this.value)))
    }
  }
}
</script>

<style scoped>

</style>
