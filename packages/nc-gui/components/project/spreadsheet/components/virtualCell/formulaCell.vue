<template>
  <v-tooltip
    v-if="column.formula && column.formula.error && column.formula.error.length"
    bottom
    color="error"
  >
    <template #activator="{on}">
      <span class="caption" v-on="on">ERR<span class="error--text">!</span></span>
    </template>
    <span class=" font-weight-bold">{{ column.formula.error.join(', ') }}</span>
  </v-tooltip>
  <div v-else>
    {{ row[column._cn] }}
  </div>
</template>

<script>
export default {
  name: 'FormulaCell',
  props: ['column', 'row']
}
</script>

<style scoped>

</style>
