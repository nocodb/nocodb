<template>
  <span>{{ dateTime }}</span>
</template>

<script>
import dayjs from 'dayjs';

export default {
  name: 'DateTimeCell',
  props: ['value'],
  computed: {
    dateTime() {
      return !this.value
        ? this.value
        : (/^\d+$/.test(this.value) ? dayjs(+this.value) : dayjs(this.value)).format('YYYY-MM-DD HH:mm');
    },
  },
};
</script>

<style scoped></style>
