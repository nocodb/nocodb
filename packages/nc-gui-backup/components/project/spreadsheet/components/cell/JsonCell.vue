<template>
  <pre class="text-left caption" style="max-height: 100px; overflow: auto">{{ value }}</pre>
</template>

<script>
export default {
  name: 'JsonCell',
  props: ['value'],
};
</script>

<style scoped></style>
