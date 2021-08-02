<template>
  <div>{{ row[column._cn] }}</div>
</template>

<script>
export default {
  name: 'FormulaCell',
  props: ['column', 'row']
}
</script>

<style scoped>

</style>
