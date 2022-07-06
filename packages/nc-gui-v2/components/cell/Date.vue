<script>
import dayjs from 'dayjs'

export default {
  name: 'DateCell',
  props: ['value'],
  computed: {
    date() {
      return (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)).format('YYYY-MM-DD')
    },
  },
}
</script>

<template>
  <span>{{ date }}</span>
</template>

<style scoped></style>
