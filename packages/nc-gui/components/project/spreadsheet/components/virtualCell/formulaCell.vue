<template>
  <v-tooltip
    v-if="column && column.colOptions&& column.colOptions.error"
    bottom
    color="error"
  >
    <template #activator="{on}">
      <span class="caption" v-on="on">ERR<span class="error--text">!</span></span>
    </template>
    <span class=" font-weight-bold">{{ column.colOptions.error }}</span>
  </v-tooltip>
  <div v-else-if="urls" v-html="urls" />
  <div v-else>
    {{ row[column.title] }}
  </div>
</template>

<script>
export default {
  name: 'FormulaCell',
  props: { column: Object, row: Object },
  computed: {
    urls() {
      if (!this.row[this.column.title]) { return }

      const rawText = this.row[this.column.title].toString()
      let found = false
      const out = rawText.match(/URI::\((.*?)\)/g, (_, url) => {
        found = true
        const a = document.createElement('a')
        a.textContent = url
        a.setAttribute('href', url)
        return a.innerHTML
      })

      return found && out
    }
  }
}
</script>

<style scoped>/**/

</style>
