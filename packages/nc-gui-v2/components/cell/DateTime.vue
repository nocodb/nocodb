<script>
import dayjs from 'dayjs'

export default {
  name: 'DateTimeCell',
  props: ['value'],
  computed: {
    dateTime() {
      return !this.value
        ? this.value
        : (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)).format('YYYY-MM-DD HH:mm')
    },
  },
}
</script>

<template>
  <span>{{ dateTime }}</span>
</template>

<style scoped></style>
