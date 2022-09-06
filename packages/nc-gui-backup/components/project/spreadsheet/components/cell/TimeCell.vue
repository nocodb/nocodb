<template>
  <span>{{ time }}</span>
</template>

<script>
export default {
  name: 'TimeCell',
  props: ['value'],
  computed: {
    time() {
      return typeof this.value === 'string' ? this.value.replace(/(\d)T(?=\d)/, '$1 ') : this.value;
    },
  },
};
</script>

<style scoped></style>
