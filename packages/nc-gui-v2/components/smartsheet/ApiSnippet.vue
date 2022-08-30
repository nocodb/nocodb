<script setup lang="ts">
import HTTPSnippet from 'httpsnippet'
import { useClipboard } from '@vueuse/core'
import { message } from 'ant-design-vue'
import { ActiveViewInj, MetaInj } from '~/context'
import { inject, useGlobal, useProject, useSmartsheetStoreOrThrow, useVModel, useViewData } from '#imports'

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

interface Props {
  modelValue: boolean
}

const { project } = $(useProject())

const { appInfo, token } = $(useGlobal())

const meta = $(inject(MetaInj)!)

const view = $(inject(ActiveViewInj)!)

const { xWhere } = useSmartsheetStoreOrThrow()

const { queryParams } = $(useViewData($$(meta), view as any, xWhere))

const { copy } = useClipboard()

let vModel = $(useVModel(props, 'modelValue', emits))

const langs = [
  {
    name: 'shell',
    clients: ['curl', 'wget'],
  },
  {
    name: 'javascript',
    clients: ['axios', 'fetch', 'jquery', 'xhr'],
  },
  {
    name: 'node',
    clients: ['axios', 'fetch', 'request', 'native', 'unirest'],
  },
  {
    name: 'nocodb-sdk',
    clients: ['javascript', 'node'],
  },
  {
    name: 'php',
  },
  {
    name: 'python',
    clients: ['python3', 'requests'],
  },
  {
    name: 'ruby',
  },
  {
    name: 'java',
  },
  {
    name: 'c',
  },
]

const selectedClient = $ref<string | undefined>(langs[0].clients && langs[0].clients[0])

const selectedLangName = $ref(langs[0].name)

const apiUrl = $computed(
  () =>
    new URL(`/api/v1/db/data/noco/${project.id}/${meta.title}/views/${view.title}`, (appInfo && appInfo.ncSiteUrl) || '/').href,
)

const snippet = $computed(
  () =>
    new HTTPSnippet({
      method: 'GET',
      headers: [{ name: 'xc-auth', value: token, comment: 'JWT Auth token' }],
      url: apiUrl,
      queryString: Object.entries(queryParams || {}).map(([name, value]) => {
        return {
          name,
          value: String(value),
        }
      }),
    }),
)

const activeLang = $computed(() => langs.find((lang) => lang.name === selectedLangName))

const code = $computed(() => {
  if (activeLang?.name === 'nocodb-sdk') {
    return `${selectedClient === 'node' ? 'const { Api } require("nocodb-sdk");' : 'import { Api } from "nocodb-sdk";'}
const api = new Api({
  baseURL: ${JSON.stringify(apiUrl)},
  headers: {
    "xc-auth": ${JSON.stringify(token as string)}
  }
})

api.dbViewRow.list(
  "noco",
  ${JSON.stringify(project.title)},
  ${JSON.stringify(meta.title)},
  ${JSON.stringify(view.title)}, ${JSON.stringify(queryParams, null, 4)}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});
    `
  }

  return snippet.convert(activeLang?.name, selectedClient || (activeLang?.clients && activeLang?.clients[0]), {})
})

const onCopyToClipboard = () => {
  copy(code)
  message.info('Copied to clipboard')
}

const afterVisibleChange = (visible: boolean) => {
  vModel = visible
}
</script>

<template>
  <a-drawer
    v-model:visible="vModel"
    class="h-full relative"
    style="color: red"
    placement="right"
    size="large"
    :closable="false"
    @after-visible-change="afterVisibleChange"
  >
    <div class="flex flex-col w-full h-full p-4">
      <a-typography-title :level="4" class="pb-1">Code Snippet</a-typography-title>
      <a-tabs v-model:activeKey="selectedLangName" class="!h-full">
        <a-tab-pane v-for="item in langs" :key="item.name" class="!h-full">
          <template #tab>
            <div class="capitalize select-none">
              {{ item.name }}
            </div>
          </template>
          <monaco-editor
            class="h-[60vh] border-1 border-gray-100 py-4 rounded-sm"
            :model-value="code"
            :read-only="true"
            lang="typescript"
            :validate="false"
            :disable-deep-compare="true"
            hide-minimap
          />
          <div class="flex flex-row w-full justify-end space-x-3 mt-4 uppercase">
            <a-select v-if="activeLang" v-model:value="selectedClient" style="width: 6rem">
              <a-select-option v-for="(client, i) in activeLang?.clients" :key="i" class="!w-full uppercase" :value="client">
                {{ client }}
              </a-select-option>
            </a-select>
            <a-button
              v-t="[
                'c:snippet:copy',
                { client: activeLang?.clients && (selectedClient || activeLang?.clients[0]), lang: activeLang?.name },
              ]"
              type="primary"
              @click="onCopyToClipboard"
              >Copy to clipboard
            </a-button>
          </div>

          <div class="absolute bottom-4 flex flex-row justify-center w-[95%]">
            <a
              v-t="['e:hiring']"
              class="px-4 py-2 ! rounded shadow"
              href="https://angel.co/company/nocodb"
              target="_blank"
              @click.stop
            >
              🚀 We are Hiring! 🚀
            </a>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-drawer>
</template>
