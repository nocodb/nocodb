<script setup lang="ts">
import HTTPSnippet from 'httpsnippet'
import {
  ActiveViewInj,
  MetaInj,
  inject,
  message,
  ref,
  storeToRefs,
  useCopy,
  useGlobal,
  useI18n,
  useProject,
  useSmartsheetStoreOrThrow,
  useVModel,
  useViewData,
  watch,
} from '#imports'

const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const { t } = useI18n()

const projectStore = useProject()
const { project } = storeToRefs(projectStore)

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
      `/api/v1/db/data/noco/${project.value.id}/${meta.value?.title}/views/${view.value?.title}`,
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
  ${JSON.stringify(project.value.title)},
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
  <div class="flex flex-col w-full h-full px-6 mt-1">
    <NcTabs v-model:activeKey="selectedLangName" class="!h-full">
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
          <NcSelect v-model:value="selectedClient" style="width: 6rem" dropdown-class-name="nc-dropdown-snippet-active-lang">
            <a-select-option v-for="(client, i) in activeLang?.clients" :key="i" class="!w-full uppercase" :value="client">
              {{ client }}
            </a-select-option>
          </NcSelect>

          <NcButton
            v-e="[
              'c:snippet:copy',
              { client: activeLang?.clients && (selectedClient || activeLang?.clients[0]), lang: activeLang?.name },
            ]"
            type="primary"
            size="small"
            @click="onCopyToClipboard"
          >
            <div class="flex px-2">
              {{ $t('general.copy') }}
            </div>
          </NcButton>
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style scoped>
:deep(.ant-tabs-tab + .ant-tabs-tab) {
  @apply !ml-7;
}
</style>
