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
  <div v-else-if="urls" v-html="urls"></div>
  <div v-else>
    {{ row[column._cn] }}
  </div>
</template>

<script>
export default {
  name: 'FormulaCell',
  props: ['column', 'row'],
  computed: {
    urls: function() {
      if(this.row[this.column._cn] ) {
        let rawText = this.row[this.column._cn].toString();
        let matchURLs = rawText.match(/URI::\((.*?)\)/g);
        if(matchURLs) {
          for(const url of matchURLs) {
            let tmpuri = url.match(/URI::\((.*?)\)/)[1];
            rawText = rawText.replace(url, '<a href="' + tmpuri + '" target="_blank">' + tmpuri + '</a>');
          }
          return rawText;
        }
      }
      return false;
    }
  }
}
</script>

<style scoped>

</style>
