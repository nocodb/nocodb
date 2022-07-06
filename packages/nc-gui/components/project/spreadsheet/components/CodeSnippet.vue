<template>
  <div class="nc-container" :class="{ active: modal }" @click="modal = false">
    <div class="nc-snippet elevation-3 pa-4 d-flex flex-column" @click.stop>
      <div>
        <h3 class="font-weight-medium mb-4">Code Snippet</h3>

        <v-icon class="nc-snippet-close" @click="modal = false"> mdi-close </v-icon>

        <div v-if="modal">
          <v-tabs v-model="tab" height="30" show-arrows @change="client = null">
            <v-tab v-for="{ lang } in langs" :key="lang" v-t="['c:snippet:tab', { lang }]" class="caption">
              {{ lang }}
            </v-tab>
          </v-tabs>
          <div class="nc-snippet-wrapper mt-4">
            <div class="nc-snippet-actions d-flex">
              <v-btn
                v-t="[
                  'c:snippet:copy',
                  { client: langs[tab].clients && (client || langs[tab].clients[0]), lang: langs[tab || 0].lang },
                ]"
                color="primary"
                class="rounded caption"
                @click="copyToClipboard"
              >
                <v-icon small> mdi-clipboard-outline </v-icon>
                Copy To Clipboard
              </v-btn>
              <div v-if="langs[tab].clients" class="ml-2 d-flex align-center">
                <v-menu bottom offset-y>
                  <template #activator="{ on }">
                    <v-btn class="caption text-uppercase" color="primary" v-on="on">
                      {{ client || langs[tab].clients[0] }}
                      <v-icon small> mdi-chevron-down </v-icon>
                    </v-btn>
                  </template>
                  <v-list dense>
                    <v-list-item v-for="c in langs[tab].clients" :key="c" dense @click="client = c">
                      <v-list-item-title class="text-uppercase">
                        {{ c }}
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </div>
            <custom-monaco-editor
              hide-line-num
              :theme="$store.state.settings.darkTheme ? 'vs-dark' : 'vs-light'"
              style="min-height: 500px; max-width: 100%"
              :value="code"
              read-only
            />
          </div>
        </div>
      </div>
      <v-spacer />
      <v-btn
        v-t="['e:hiring']"
        color="primary"
        outlined
        class="caption my-2 mx-auto"
        href="https://angel.co/company/nocodb"
        target="_blank"
      >
        🚀 We are Hiring! 🚀
      </v-btn>
    </div>
  </div>
</template>

<script>
import HTTPSnippet from 'httpsnippet';
import CustomMonacoEditor from '~/components/monaco/CustomMonacoEditor';
import { copyTextToClipboard } from '~/helpers/xutils';

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
    value: Boolean,
  },
  data: () => ({
    tab: 0,
    client: null,
    langs: [
      {
        lang: 'shell',
        clients: ['curl', 'wget'],
      },
      {
        lang: 'javascript',
        clients: ['axios', 'fetch', 'jquery', 'xhr'],
      },
      {
        lang: 'node',
        clients: ['axios', 'fetch', 'request', 'native', 'unirest'],
      },
      {
        lang: 'nocodb-sdk',
        clients: ['javascript', 'node'],
      },
      {
        lang: 'php',
      },
      {
        lang: 'python',
        clients: ['python3', 'requests'],
      },
      {
        lang: 'ruby',
      },
      {
        lang: 'java',
      },
      {
        lang: 'c',
      },
    ],
  }),
  computed: {
    modal: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
    apiUrl() {
      return new URL(
        `/api/v1/db/data/noco/${this.projectId}/${this.meta.title}/views/${this.view.title}`,
        (this.$store.state.project.appInfo && this.$store.state.project.appInfo.ncSiteUrl) || '/'
      ).href;
    },
    snippet() {
      return new HTTPSnippet({
        method: 'GET',
        headers: [{ name: 'xc-auth', value: this.$store.state.users.token, comment: 'JWT Auth token' }],
        url: this.apiUrl,
        queryString: Object.entries(this.queryParams || {}).map(([name, value]) => {
          return {
            name,
            value: String(value),
          };
        }),
      });
    },
    code() {
      if (this.langs[this.tab].lang === 'nocodb-sdk') {
        return `${this.client === 'node' ? 'const { Api } require("nocodb-sdk");' : 'import { Api } from "nocodb-sdk";'}

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
  ${JSON.stringify(this.view.title)}, ${JSON.stringify(this.queryParams, null, 4)}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});`;
      }

      return this.snippet.convert(
        this.langs[this.tab].lang,
        this.client || (this.langs[this.tab].clients && this.langs[this.tab].clients[0]),
        {}
      );
    },
  },
  mounted() {
    (document.querySelector('[data-app]') || this.$root.$el).append(this.$el);
  },

  destroyed() {
    this.$el.parentNode && this.$el.parentNode.removeChild(this.$el);
  },
  methods: {
    copyToClipboard() {
      copyTextToClipboard(this.code);
      this.$toast.success('Code copied to clipboard successfully.').goAway(3000);
    },
  },
};
</script>

<style scoped lang="scss">
.nc-snippet-wrapper {
  position: relative;
  border: 1px solid #7773;
  border-radius: 4px;
  overflow: hidden;
}

.nc-snippet-actions {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 99999;
}

.nc-container {
  position: fixed;
  pointer-events: none;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  right: 0;
  top: 0;

  .nc-snippet {
    background-color: var(--v-backgroundColorDefault-base);
    height: 100%;
    width: max(50%, 700px);
    position: absolute;
    bottom: 0;
    top: 0;
    right: min(-50%, -700px);
    transition: 0.3s right;
  }

  &.active {
    pointer-events: all;

    & > .nc-snippet {
      right: 0;
    }
  }

  .nc-snippet-close {
    position: absolute;
    right: 16px;
    top: 16px;
  }
}

::v-deep {
  .v-tabs {
    height: 100%;

    .v-tabs-items {
      height: calc(100% - 30px);

      .v-window__container {
        height: 100%;
      }
    }
  }

  .v-slide-group__prev--disabled {
    display: none;
  }
}
</style>
