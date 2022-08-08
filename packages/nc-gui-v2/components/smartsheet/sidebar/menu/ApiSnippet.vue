<script setup lang="ts">
import HTTPSnippet from 'httpsnippet'
import { ActiveViewInj, MetaInj } from '~~/context'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])
const { project } = $(useProject())
const meta = $(inject(MetaInj))
const view = $(inject(ActiveViewInj))
const { xWhere } = useSmartsheetStoreOrThrow()
const { queryParams } = $(useViewData(meta, view as any, xWhere))

const { $state, $api } = useNuxtApp()
let vModel = $(useVModel(props, 'modelValue', emits))

const client = $ref<string | undefined>(undefined)

const appInfo = await $api.utils.appInfo()

const langs = [
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
]

const activeTabKey = $ref(langs[0].lang)
const afterVisibleChange = (visible: boolean) => {
  vModel = visible
}

const apiUrl = () => {
  console.log(`/api/v1/db/data/noco/${project.id}/${meta.title}/views/${view.title}`)
  return new URL(`/api/v1/db/data/noco/${project.id}/${meta.title}/views/${view.title}`, (appInfo && appInfo.ncSiteUrl) || '/')
    .href
}

// const apiUrl = $computed(() => {
//   console.log(`/api/v1/db/data/noco/${project.id}/${meta.title}/views/${view.title}`)
//   return new URL(`/api/v1/db/data/noco/${project.id}/${meta.title}/views/${view.title}`, (appInfo && appInfo.ncSiteUrl) || '/')
//     .href
// })

const snippet = $computed(
  () =>
    new HTTPSnippet({
      method: 'GET',
      headers: [{ name: 'xc-auth', value: $state.token.value as string, comment: 'JWT Auth token' }],
      url: apiUrl(),
      queryString: Object.entries(queryParams || {}).map(([name, value]) => {
        return {
          name,
          value: String(value),
        }
      }),
    }),
)

console.log('snippet.value', snippet)

const activeLang = $computed(() => langs.find((lang) => lang.lang === activeTabKey))
const code = $computed(() => {
  if (activeLang?.lang === 'nocodb-sdk') {
    return `
    ${client === 'node' ? 'const { Api } require("nocodb-sdk");' : 'import { Api } from "nocodb-sdk";'}

const api = new Api({
  baseURL: ${JSON.stringify(apiUrl)},
  headers: {
    "xc-auth": ${JSON.stringify($state.token.value as string)}
  }
})

api.dbViewRow.list(
  "noco",
  ${JSON.stringify(project.title)},
  ${JSON.stringify(meta.value.title)},
  ${JSON.stringify(view.value.title)}, ${JSON.stringify(queryParams, null, 4)}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});
    `
  }

  return snippet.convert(activeLang?.lang, client || (activeLang?.clients && activeLang?.clients[0]), {})
})

console.log(code)
</script>

<template>
  <a-drawer
    v-model:visible="vModel"
    class="custom-class"
    style="color: red"
    placement="right"
    size="large"
    :closable="false"
    @after-visible-change="afterVisibleChange"
  >
    <div class="flex flex-col">
      <a-typography-title :level="4">Code Snippet</a-typography-title>
      <a-tabs v-model:activeKey="activeTabKey" class="!capitalize">
        <a-tab-pane v-for="item in langs" :key="item.lang">
          <template #tab>
            <div class="capitalize select-none">
              {{ item.lang }}
            </div>
          </template>
          Content of Tab Pane 1
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-drawer>
</template>

<style scoped></style>
