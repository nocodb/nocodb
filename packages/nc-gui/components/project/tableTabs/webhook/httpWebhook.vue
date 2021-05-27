<template>
  <div>

    <div class="d-flex">
      <v-select
        outlined
        dense
        class="caption"
        v-model="api.method"
        :items="Object.keys(apiMethodMeta)" style="max-width:100px;"></v-select>
      <v-text-field
        outlined
        placeholder="http://example.com"
        v-model="api.path"
        dense class="flex-grow-1 ml-2 caption"></v-text-field>
    </div>


    <v-tabs
      v-model="tab"
      class="req-tabs"
      height="24"
    >
      <v-tab v-ge="['api-client','params']" class="caption"><span class="text-capitalize"> Params&nbsp;<b
        v-if="paramsCount"
        class="green--text">({{ paramsCount }})</b></span>
      </v-tab>
      <v-tab class="caption" v-ge="['api-client','headers']"><span class="text-capitalize">Headers&nbsp;<b
        v-if="headersCount"
        class="green--text">({{
          headersCount
        }})</b></span>
      </v-tab>
      <v-tab class="caption" v-ge="['api-client','body']"><span class="text-capitalize">Body</span></v-tab>
      <v-tab class="caption" v-ge="['api-client','auth']"><span class="text-capitalize">Auth</span></v-tab>
      <v-tab-item>

        <params v-model="api.parameters"
                :env.sync="selectedEnv"
        ></params>
      </v-tab-item>
      <v-tab-item>
        <headers v-model="api.headers"
                 :env.sync="selectedEnv"
        ></headers>
      </v-tab-item>
      <v-tab-item>
        <monaco-json-editor
          style="height: 250px"
          class="editor card text-left"
          theme="vs-dark"
          v-model="api.body"
          language="json"
          :options="{validate:true,documentFormattingEdits:true,foldingRanges:true}"
        >
        </monaco-json-editor>

      </v-tab-item>
      <v-tab-item>
        <!--                <monaco-editor-->
        <!--                  :code.sync="api.auth"-->
        <!--                  cssStyle="height:250px"></monaco-editor>-->
      </v-tab-item>


    </v-tabs>
  </div>
</template>

<script>
import params from "../../../apiClient/params";
import headers from "../../../apiClient/headers";

import {MonacoJsonEditor} from "../../../monaco/index";

export default {
  tab:0,
  props: {
    value: Object
  },
  components: {
    params,
    headers,
    MonacoJsonEditor
  },
  name: "httpWebhook",
  data: () => ({
    apiMethodMeta: {
      GET: {
        color: 'success'
      },
      POST: {
        color: 'warning'
      },
      DELETE: {
        color: 'error'
      },
      PUT: {
        color: 'info'
      },
      HEAD: {
        color: 'info'
      },
      PATCH: {
        color: 'info'
      },
    },
    selectedEnv: 'dev',
    environmentList: ['dev'],
    // current api
    api: {
      method: 'GET',
      path: '',
      body: '',
      params: [],
      auth: '',
      headers: [],
      response: {},
      perf: {},
      meta: {}
    },
  }),
  created() {
    this.api = this.value || this.api;
  },
  watch: {
    value() {
      if (this.api !== this.value) {
        this.api = this.value || this.api;
      }
    },
    api: {
      handler() {
        this.$emit('input', this.api)
      }
    }
  },
  computed: {

    paramsCount() {
      return this.api.parameters && this.api.parameters.filter(p => p.name && p.enabled).length;
    },
    headersCount() {

      return this.api.headers && this.api.headers.filter(h => h.name && h.enabled).length;
    },
  }
}
</script>

<style scoped>

</style>
