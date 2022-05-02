<template>
  <v-dialog :value="true">
    <v-card style="overflow: hidden">
      <v-tabs v-model="tab" height="30">
        <v-tab
          v-for="{lang} in langs"
          :key="lang"
          class="caption"
        >
          {{ lang }}
        </v-tab>
      </v-tabs>
      <div class="nc-snippet-wrapper">
        <div class="nc-snippet-actions">
          <v-icon>mdi-clipboard</v-icon>sdds
          <v-select
            v-if="langs[tab].clients"
            v-model="client"
            class="nc-snippet-client"
            outlined
            dense
            hide-details
            style="max-width: 100px"
          />
        </div>
        <custom-monaco-editor style="min-height:500px;max-width: 100%" :value="code" read-only />
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import HTTPSnippet from 'httpsnippet'
import CustomMonacoEditor from '~/components/monaco/CustomMonacoEditor'
export default {
  name: 'CodeSnippet',
  components: { CustomMonacoEditor },
  props: {
    meta: Object,
    view: Object,
    filters: [Object, Array],
    sorts: [Object, Array],
    fileds: [Object, Array]
  },
  data: () => ({
    tab: 0,
    client: null,
    langs: [
      {
        lang: 'javascript',
        clients: ['XMLHttpRequest', 'jQuery.ajax']
      },
      {
        lang: 'node'
      },
      {
        lang: 'shell'
      },
      {
        lang: 'php'
      },
      {
        lang: 'python'
      },
      {
        lang: 'ruby'
      },
      {
        lang: 'c'
      }
    ]
  }),
  computed: {
    snippet() {
      return new HTTPSnippet({
        method: 'GET',
        headers: [
          { name: 'xc-auth', value: this.$store.state.users.token, comment: 'JWT Auth token' }
        ],
        url: new URL(`/api/v1/db/data/noco/${this.projectId}/${this.meta.title}/views/${this.view.title}`, this.$store.state.project.projectInfo.ncSiteUrl).href
      })
    },
    code() {
      return this.snippet.convert(this.langs[this.tab].lang, this.client)
    }
  }
}
</script>

<style scoped>
.nc-snippet-wrapper{
  position:relative;
}
.nc-snippet-actions{
  position: absolute;
  right: 10px;
  top:40px;
}
</style>
