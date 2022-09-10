<template>
  <div>
    <div class="d-flex">
      <v-select
        v-model="api.method"
        outlined
        dense
        class="caption nc-select-hook-url-method"
        :items="Object.keys(apiMethodMeta)"
        style="max-width: 100px"
      />
      <v-text-field
        v-model="api.path"
        outlined
        placeholder="http://example.com"
        dense
        class="flex-grow-1 ml-2 caption nc-text-field-hook-url-path"
      />
    </div>

    <v-tabs v-model="tab" class="req-tabs" height="24">
      <v-tab v-ge="['api-client', 'body']" class="caption">
        <span class="text-capitalize">Body</span>
      </v-tab>
      <v-tab v-ge="['api-client', 'params']" class="caption">
        <span class="text-capitalize">
          Params&nbsp;<b v-if="paramsCount" class="green--text">({{ paramsCount }})</b></span
        >
      </v-tab>
      <v-tab v-ge="['api-client', 'headers']" class="caption">
        <span class="text-capitalize nc-tab-hook-header"
          >Headers&nbsp;<b v-if="headersCount" class="green--text">({{ headersCount }})</b></span
        >
      </v-tab>
      <v-tab v-ge="['api-client', 'auth']" class="caption">
        <span class="text-capitalize">Auth</span>
      </v-tab>
      <v-tab-item>
        <monaco-handlebar-editor
          v-model="api.body"
          style="height: 250px"
          class="editor card text-left"
          theme="vs-dark"
          lang="json"
          :options="{ validate: true, documentFormattingEdits: true, foldingRanges: true }"
        />
      </v-tab-item>
      <v-tab-item>
        <params v-model="api.parameters" :env.sync="selectedEnv" />
      </v-tab-item>
      <v-tab-item>
        <headers v-model="api.headers" :env.sync="selectedEnv" />
      </v-tab-item>

      <v-tab-item>
        <monaco-handlebar-editor
          v-model="api.auth"
          style="height: 250px"
          class="editor card text-left"
          theme="vs-dark"
          :options="{ validate: true, documentFormattingEdits: true, foldingRanges: true }"
        />
        <span class="caption grey--text"
          >For more about auth option refer
          <a href="https://github.com/axios/axios#request-config" target="_blank">axios docs</a>.</span
        >
      </v-tab-item>
    </v-tabs>
  </div>
</template>

<script>
import params from '../../../apiClient/Params';
import headers from '../../../apiClient/Headers';

import { MonacoHandlebarEditor } from '../../../monaco/index';

export default {
  tab: 0,
  name: 'HttpWebhook',
  components: {
    params,
    headers,
    MonacoHandlebarEditor,
  },
  props: {
    value: Object,
  },
  data: () => ({
    apiMethodMeta: {
      GET: {
        color: 'success',
      },
      POST: {
        color: 'warning',
      },
      DELETE: {
        color: 'error',
      },
      PUT: {
        color: 'info',
      },
      HEAD: {
        color: 'info',
      },
      PATCH: {
        color: 'info',
      },
    },
    selectedEnv: '_noco',
    environmentList: ['_noco'],
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
      meta: {},
    },
    tab: 0,
  }),
  computed: {
    paramsCount() {
      return this.api.parameters && this.api.parameters.filter(p => p.name && p.enabled).length;
    },
    headersCount() {
      return this.api.headers && this.api.headers.filter(h => h.name && h.enabled).length;
    },
  },
  watch: {
    value() {
      if (this.api !== this.value) {
        this.api = this.value || this.api;
      }
    },
    api: {
      handler() {
        this.$emit('input', this.api);
      },
    },
  },
  created() {
    this.api = this.value || this.api;
  },
};
</script>

<style scoped></style>
