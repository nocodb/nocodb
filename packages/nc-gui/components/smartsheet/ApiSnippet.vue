<script setup lang="ts">
import HTTPSnippet from 'httpsnippet'

const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const { t } = useI18n()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { appInfo, token } = useGlobal()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { xWhere } = useSmartsheetStoreOrThrow()

const { queryParams } = useViewData(meta, view, xWhere)

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

const apiUrl = computed(
  () =>
    new URL(
      `/api/v1/db/data/noco/${base.value.id}/${meta.value?.id}/views/${view.value?.id}`,
      (appInfo.value && appInfo.value.ncSiteUrl) || '/',
    ).href,
)

const snippet = computed(
  () =>
    new HTTPSnippet({
      method: 'GET',
      headers: [{ name: 'xc-auth', value: token.value, comment: 'JWT Auth token' }],
      url: apiUrl.value,
      queryString: Object.entries(queryParams.value || {}).map(([name, value]) => {
        return {
          name,
          value: String(value),
        }
      }),
    }),
)

const activeLang = computed(() => langs.find((lang) => lang.name === selectedLangName.value))

const code = computed(() => {
  if (activeLang.value?.name === 'nocodb-sdk') {
    return `${selectedClient.value === 'node' ? 'const { Api } = require("nocodb-sdk");' : 'import { Api } from "nocodb-sdk";'}
const api = new Api({
  baseURL: "${(appInfo.value && appInfo.value.ncSiteUrl) || '/'}",
  headers: {
    "xc-auth": ${JSON.stringify(token.value as string)}
  }
})

api.dbViewRow.list(
  "noco",
  ${JSON.stringify(base.value.title)},
  ${JSON.stringify(meta.value?.title)},
  ${JSON.stringify(view.value?.title)}, ${JSON.stringify(queryParams.value, null, 4)}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});
    `
  }

  return snippet.value.convert(
    activeLang.value?.name,
    selectedClient.value || (activeLang.value?.clients && activeLang.value?.clients[0]),
    {},
  )
})

const onCopyToClipboard = async () => {
  try {
    await copy(code.value)
    // Copied to clipboard
    message.info(t('msg.info.copiedToClipboard'))
  } catch (e: any) {
    message.error(e.message)
  }
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
      <!--      Code Snippet -->
      <a-typography-title :level="4" class="pb-1">{{ $t('title.codeSnippet') }}</a-typography-title>

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
            <a-select v-model:value="selectedClient" style="width: 6rem" dropdown-class-name="nc-dropdown-snippet-active-lang">
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
              rel="noopener noreferrer"
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
