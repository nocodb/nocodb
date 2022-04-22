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
    {{ result }}
  </div>
</template>

<script>
import dayjs from 'dayjs'

export default {
  name: 'FormulaCell',
  props: { column: Object, row: Object, client: String },
  computed: {
    result() {
      if (this.client === 'pg') {
        return this.handleTZ(this.row[this.column.title])
      }
      return this.row[this.column.title]
    },
    urls() {
      if (!this.row[this.column.title]) { return }

      const rawText = this.result.toString()
      let found = false
      const out = rawText.replace(/URI::\((.*?)\)/g, (_, url) => {
        found = true
        const a = document.createElement('a')
        a.textContent = url
        a.setAttribute('href', url)
        a.setAttribute('target', '_blank')
        return a.outerHTML
      })

      return found && out
    }
  },
  methods: {
    // handle date returned from PostgreSQL
    handleTZ(val) {
      if (!val) { return }
      return val.replace(/((?:-?(?:[1-9][0-9]*)?[0-9]{4})-(?:1[0-2]|0[1-9])-(?:3[01]|0[1-9]|[12][0-9])T(?:2[0-3]|[01][0-9]):(?:[0-5][0-9]):(?:[0-5][0-9])(?:\.[0-9]+)?(?:Z|[+-](?:2[0-3]|[01][0-9]):[0-5][0-9]))/g, (i, v) => {
        return dayjs(v).format('YYYY-MM-DD HH:mm')
      })
    }
  }
}
</script>

<style scoped>/**/

</style>
