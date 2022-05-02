<template>
  <v-dialog v-model="modal">
    <v-card style="overflow: hidden">
      <v-tabs v-model="tab" height="30" @change="client=null">
        <v-tab
          v-for="{lang} in langs"
          :key="lang"
          class="caption"
        >
          {{ lang }}
        </v-tab>
      </v-tabs>
      <div class="nc-snippet-wrapper">
        <div class="nc-snippet-actions d-flex">
          <v-btn color="primary" class="rounded caption " @click="copyToClipboard">
            <v-icon small>
              mdi-clipboard-outline
            </v-icon> Copy To Clipboard
          </v-btn>
          <div
            v-if="langs[tab].clients"
            class=" ml-2 d-flex align-center"
          >
            <v-menu bottom offset-y>
              <template #activator="{on}">
                <v-btn class="caption" color="primary" v-on="on">
                  {{ client || langs[tab].clients[0] }} <v-icon small>
                    mdi-chevron-down
                  </v-icon>
                </v-btn>
              </template>
              <v-list dense>
                <v-list-item v-for="c in langs[tab].clients" :key="c" dense @click="client = c">
                  <v-list-item-title>{{ c }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
        <custom-monaco-editor style="min-height:500px;max-width: 100%" :value="code" read-only />
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import HTTPSnippet from 'httpsnippet'
import CustomMonacoEditor from '~/components/monaco/CustomMonacoEditor'
import { copyTextToClipboard } from '~/helpers/xutils'
export default {
  name: 'CodeSnippet',
  components: { CustomMonacoEditor },
  props: {
    meta: Object,
    view: Object,
    filters: [Object, Array],
    sorts: [Object, Array],
    fileds: [Object, Array],
    queryParams: Object,
    value: Boolean
  },
  data: () => ({
    tab: 0,
    client: null,
    langs: [
      {
        lang: 'shell',
        clients: ['curl', 'wget']
      },
      {
        lang: 'javascript',
        clients: ['axios', 'fetch', 'jquery', 'xhr']
      },
      {
        lang: 'node',
        clients: ['axios', 'fetch', 'request', 'native', 'unirest']
      },
      {
        lang: 'nocodb-sdk',
        clients: ['javascript', 'node']
      },
      {
        lang: 'php'
      },
      {
        lang: 'python',
        clients: ['python3',
          'requests']
      },
      {
        lang: 'ruby'
      },
      {
        lang: 'java'
      },
      {
        lang: 'c'
      }
    ]
  }),
  computed: {
    modal: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit('input', v)
      }
    },
    apiUrl() {
      return new URL(`/api/v1/db/data/noco/${this.projectId}/${this.meta.title}/views/${this.view.title}`, this.$store.state.project.projectInfo.ncSiteUrl).href
    },
    snippet() {
      return new HTTPSnippet({
        method: 'GET',
        headers: [
          { name: 'xc-auth', value: this.$store.state.users.token, comment: 'JWT Auth token' }
        ],
        url: this.apiUrl,
        queryString: Object.entries(this.queryParams || {}).map(([name, value]) => {
          return {
            name, value: String(value)
          }
        })
      })
    },
    code() {
      if (this.langs[this.tab].lang === 'nocodb-sdk') {
        return `${
          this.client === 'node'
            ? 'const { Api } require("nocodb-sdk");'
          : 'import { Api } from "nocodb-sdk";'
        }

const api = new Api({
  baseURL: ${JSON.stringify(this.apiUrl)},
  headers: {
    "xc-auth": ${JSON.stringify(this.$store.state.users.token)}
  }
})

api.dbViewRow.list(
  "noco",
  ${JSON.stringify(this.projectName)},
  ${JSON.stringify(this.meta.title)},
  ${JSON.stringify(this.view.title)},
  ${JSON.stringify(this.queryParams, null, 2)}
).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});`
      }

      return this.snippet.convert(this.langs[this.tab].lang, this.client || (this.langs[this.tab].clients && this.langs[this.tab].clients[0]), {})
    }
  },
  methods: {
    copyToClipboard() {
      copyTextToClipboard(this.code)
      this.$toast.success('Code copied to clipboard successfully.').goAway(3000)
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
  bottom:10px;
  z-index: 99999;
}
</style>
