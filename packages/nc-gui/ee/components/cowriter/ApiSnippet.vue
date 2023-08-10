<script setup lang="ts">
import HTTPSnippet from 'httpsnippet'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { MetaInj, inject, message, ref, useCopy, useCowriterStoreOrThrow, useGlobal, useI18n, useVModel, watch } from '#imports'

const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const { t } = useI18n()

const globalStore = useGlobal()
const appInfo = toRef(globalStore, 'appInfo')
const token = toRef(globalStore, 'token')

const meta = inject(MetaInj, ref())

const { supportedColumns, cowriterTable } = useCowriterStoreOrThrow()

const { copy } = useCopy()

const vModel = useVModel(props, 'modelValue', emits)

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

const selectedClient = ref<string | undefined>(langs[0].clients && langs[0].clients[0])

const selectedLangName = ref(langs[0].name)

const apiUrl = computed(() => {
  return new URL(`/api/v1/cowriter/meta/tables/${meta.value?.id}`, (appInfo.value && appInfo.value.ncSiteUrl) || '/').href
})

const cowriterData = computed(() =>
  supportedColumns.value
    ? supportedColumns.value.slice(0, 5).map((o: ColumnType) => ({
        name: o.column_name,
        value: o.uidt === UITypes.Number || o.uidt === UITypes.Decimal ? 1 : 'foo',
      }))
    : [
        {
          name: 'foo',
          value: 'bar',
        },
      ],
)

const snippet = computed(
  () =>
    new HTTPSnippet({
      method: 'POST',
      headers: [{ name: 'xc-auth', value: token.value, comment: 'JWT Auth token' }],
      url: apiUrl.value,
      postData: {
        mimeType: 'application/x-www-form-urlencoded',
        params: cowriterData.value,
      },
    }),
)

const activeLang = computed(() => langs.find((lang) => lang.name === selectedLangName.value))

const code = computed(() => {
  if (activeLang.value?.name === 'nocodb-sdk') {
    const content = `const api = new Api({
  baseURL: "${(appInfo.value && appInfo.value.ncSiteUrl) || '/'}",
  headers: {
    "xc-auth": ${JSON.stringify(token.value as string)}
  }
})

api.cowriterTable.create('${cowriterTable.value!.id!}', ${JSON.stringify(cowriterData.value[0])}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});`
    return `${selectedClient.value === 'node' ? 'const { Api } = require("nocodb-sdk");' : 'import { Api } from "nocodb-sdk";'}
${content}
    `
  }

  return snippet.value.convert(
    activeLang.value?.name,
    selectedClient.value || (activeLang.value?.clients && activeLang.value?.clients[0]),
    {},
  )
})

const onCopyToClipboard = () => {
  copy(code.value)
  // Copied to clipboard
  message.info(t('msg.info.copiedToClipboard'))
}

const afterVisibleChange = (visible: boolean) => {
  vModel.value = visible
}

watch(activeLang, (newLang) => {
  selectedClient.value = newLang?.clients?.[0]
})
</script>

<template>
  <a-drawer
    v-model:visible="vModel"
    class="h-full relative nc-drawer-api-snippet"
    placement="right"
    size="large"
    :closable="false"
    @after-visible-change="afterVisibleChange"
  >
    <div class="flex flex-col w-full h-full p-4">
      <!-- Code Snippet -->
      <a-typography-title :level="4" class="pb-1">{{ $t('title.codeSnippet') }}</a-typography-title>

      <a-typography-paragraph>
        You can use following code to start integrating your current prompt and settings into your application.
      </a-typography-paragraph>

      <a-tabs v-model:activeKey="selectedLangName" class="!h-full">
        <a-tab-pane v-for="item in langs" :key="item.name" class="!h-full">
          <template #tab>
            <div class="uppercase !text-xs select-none">
              {{ item.name }}
            </div>
          </template>

          <LazyMonacoEditor
            class="h-[60vh] border-1 border-gray-100 py-4 rounded-sm"
            :model-value="code"
            :read-only="true"
            lang="typescript"
            :validate="false"
            :disable-deep-compare="true"
            hide-minimap
          />

          <div v-if="activeLang?.clients" class="flex flex-row w-full justify-end space-x-3 mt-4 uppercase">
            <a-select v-model:value="selectedClient" style="width: 8rem" dropdown-class-name="nc-dropdown-snippet-active-lang">
              <a-select-option v-for="(client, i) in activeLang?.clients" :key="i" class="!w-full uppercase" :value="client">
                {{ client }}
              </a-select-option>
            </a-select>

            <a-button
              v-e="[
                'c:snippet:copy',
                { client: activeLang?.clients && (selectedClient || activeLang?.clients[0]), lang: activeLang?.name },
              ]"
              type="primary"
              @click="onCopyToClipboard"
            >
              {{ $t('general.copy') }}
            </a-button>
          </div>

          <div class="absolute bottom-4 flex flex-row justify-center w-[95%]">
            <a
              v-e="['e:hiring']"
              class="px-4 py-2 ! rounded shadow"
              href="https://angel.co/company/nocodb"
              target="_blank"
              @click.stop
            >
              🚀 {{ $t('labels.weAreHiring') }}! 🚀
            </a>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-drawer>
</template>

<style scoped>
:deep(.ant-tabs-tab + .ant-tabs-tab) {
  @apply !ml-7;
}
</style>
