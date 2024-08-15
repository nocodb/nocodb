<script setup lang="ts">
import HTTPSnippet from 'httpsnippet'
import { LoadingOutlined } from '@ant-design/icons-vue'

const { t } = useI18n()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { appInfo } = useGlobal()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { xWhere } = useSmartsheetStoreOrThrow()

const { queryParams } = useViewData(meta, view, xWhere)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const { copy } = useCopy()

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
  () => new URL(`/api/v2/tables/${meta.value?.id}/records`, (appInfo.value && appInfo.value.ncSiteUrl) || '/').href,
)

const snippet = computed(
  () =>
    new HTTPSnippet({
      method: 'GET',
      headers: [
        {
          name: 'xc-token',
          value: `CREATE_YOUR_API_TOKEN_FROM ${location.origin + location.pathname}#/account/tokens`,
          comment: 'API token',
        },
      ],
      url: apiUrl.value,
      queryString: [
        ...Object.entries(queryParams.value || {}).map(([name, value]) => {
          return {
            name,
            value: String(value),
          }
        }),
        { name: 'viewId', value: view.value?.id },
      ],
    }),
)

const activeLang = computed(() => langs.find((lang) => lang.name === selectedLangName.value))

const code = computed(() => {
  if (activeLang.value?.name === 'nocodb-sdk') {
    return `${selectedClient.value === 'node' ? 'const { Api } = require("nocodb-sdk");' : 'import { Api } from "nocodb-sdk";'}
    
const api = new Api({
  baseURL: "${(appInfo.value && appInfo.value.ncSiteUrl) || '/'}",
  headers: {
    "xc-token": "CREATE_YOUR_API_TOKEN_FROM ${location.origin + location.pathname}#/account/tokens"
  }
})

api.dbViewRow.list(
  "noco",
  ${JSON.stringify(base.value?.id)},
  ${JSON.stringify(meta.value?.id)},
  ${JSON.stringify(view.value?.id)}, ${JSON.stringify(queryParams.value, null, 4)}).then(function (data) {
  console.log(data);
}).catch(function (error) {
  console.error(error);
});`
  }

  return snippet.value.convert(
    activeLang.value?.name,
    selectedClient.value || (activeLang.value?.clients && activeLang.value?.clients[0]),
    { indent: '\t' },
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

watch(activeLang, (newLang) => {
  selectedClient.value = newLang?.clients?.[0]
})

const supportedDocs = [
  {
    title: 'Data APIs',
    href: '',
  },
  {
    title: 'Create API Token',
    href: '',
  },
  {
    title: 'Meta APIs',
    href: '',
  },
  {
    title: 'Swagger',
    href: '',
  },
] as {
  title: string
  href: string
}[]

const handleNavigateToDocs = (href: string) => {
  navigateTo(href, {
    open: navigateToBlankTargetOpenOption,
  })
}
</script>

<template>
  <div
    class="p-6"
    :style="{
      height: 'calc(100vh - var(--topbar-height) - var(--toolbar-height) - 16px)',
      maxHeight: 'calc(100vh - var(--topbar-height) - var(--toolbar-height) - 16px)',
    }"
  >
    <div class="flex gap-6 max-w-[1000px] mx-auto h-full">
      <NcMenu class="nc-api-snippets-menu !h-full w-[240px] min-w-[240px]">
        <div
          class="px-3 py-2 text-[11px] leading-4 text-gray-500 uppercase font-semibold"
          :style="{
            letterSpacing: '0.3px',
          }"
        >
          {{ $t('general.languages') }}
        </div>

        <NcMenuItem
          v-for="item in langs"
          :key="item.name"
          class="rounded-md capitalize select-none"
          :class="{
            'active-menu': selectedLangName === item.name,
          }"
          @click="selectedLangName = item.name"
        >
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="file" />
            {{ item.name }}
          </div>
        </NcMenuItem>

        <NcDivider class="!my-3" />

        <div
          class="p-2 text-[11px] leading-4 text-gray-500 uppercase font-semibold"
          :style="{
            letterSpacing: '0.3px',
          }"
        >
          {{ $t('labels.documentation') }}
        </div>

        <div class="flex flex-col gap-1">
          <NcButton
            v-for="(doc, idx) of supportedDocs"
            :key="idx"
            type="text"
            size="small"
            :centered="false"
            icon-position="right"
            class="children:children:flex-1"
            @click="handleNavigateToDocs(doc.href)"
          >
            <div class="flex items-center justify-between w-full">
              {{ doc.title }}

              <GeneralIcon icon="externalLink" class="flex-none" />
            </div>
          </NcButton>
        </div>
      </NcMenu>
      <div class="w-[calc(100%_-_264px)] flex flex-col gap-6 h-full max-h-full">
        <div class="flex items-center justify-between gap-3">
          <h3 class="my-0 capitalize text-2xl text-gray-800 font-bold">{{ selectedLangName }}</h3>
          <!-- Todo: add docs link  -->
          <NcButton
            type="text"
            size="small"
            icon-position="right"
            class="children:children:flex-1"
            @click="handleNavigateToDocs('')"
          >
            <div class="flex items-center gap-2">
              {{ $t('activity.goToDocs') }}

              <GeneralIcon icon="externalLink" class="flex-none" />
            </div>
          </NcButton>
        </div>

        <NcTabs v-model:activeKey="selectedClient" class="nc-api-clents-tab">
          <template #rightExtra>
            <NcButton
              v-e="[
                'c:snippet:copy',
                { client: activeLang?.clients && (selectedClient || activeLang?.clients[0]), lang: activeLang?.name },
              ]"
              type="secondary"
              size="small"
              @click="onCopyToClipboard"
            >
              <div class="flex items-center">
                <GeneralIcon icon="copy" class="mr-1" />
                {{ $t('general.copy') }} code
              </div>
            </NcButton>
          </template>
          <a-tab-pane v-for="client in activeLang?.clients || ['default']" :key="client" class="!h-full">
            <template #tab>
              <div class="text-sm capitalize select-none">
                {{ client }}
              </div>
            </template>

            <Suspense>
              <MonacoEditor
                class="h-full !bg-gray-50 pl-3"
                :model-value="code"
                :read-only="true"
                lang="typescript"
                :validate="false"
                :disable-deep-compare="true"
                :monaco-config="{
                  minimap: {
                    enabled: false,
                  },
                  fontSize: 14,
                  lineHeight: 20,
                  padding: {
                    top: 12,
                    bottom: 12,
                  },
                  overviewRulerBorder: false,
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  lineDecorationsWidth: 12,
                  lineNumbersMinChars: 0,
                  roundedSelection: false,
                  selectOnLineNumbers: false,
                  scrollBeyondLastLine: false,
                  contextmenu: false,
                  glyphMargin: false,
                  folding: false,
                  bracketPairColorization: { enabled: false },
                  wordWrap: 'on',
                  scrollbar: {
                    horizontal: 'hidden',
                    verticalScrollbarSize: 6,
                  },
                  wrappingStrategy: 'advanced',
                  renderLineHighlight: 'none',
                  tabSize: 4,
                  lineNumbers: 'on',
                }"
                hide-minimap
              />
              <template #fallback>
                <div class="h-full w-full flex flex-col justify-center items-center mt-28">
                  <a-spin size="large" :indicator="indicator" />
                </div>
              </template>
            </Suspense>
          </a-tab-pane>
        </NcTabs>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-tabs-tab + .ant-tabs-tab) {
  @apply !ml-7;
}

.nc-api-snippets-menu {
  @apply border-r-0 !py-0;

  :deep(.ant-menu-item) {
    @apply h-7 leading-5 my-1.5 px-3 text-gray-700;

    .nc-menu-item-inner {
      @apply text-small leading-[18px] text-current font-weight-500;
    }
    &:hover:not(.active-menu) {
      @apply !bg-gray-100;
    }

    &.active-menu {
      @apply bg-brand-50;
      .nc-menu-item-inner {
        @apply text-brand-600 font-semibold;
      }
    }
  }
}
:deep(.nc-api-clents-tab.ant-tabs) {
  @apply bg-gray-50 border-1 border-gray-200 rounded-lg flex-1;

  .ant-tabs-nav {
    @apply px-3;
  }
  .ant-tabs-content {
    @apply h-full;
  }
  .monaco-editor {
    @apply !border-0 !rounded-none pr-3;
  }
  .overflow-guard {
    @apply !border-0 !rounded-none;
  }
  .monaco-editor,
  .monaco-diff-editor,
  .monaco-component {
    --vscode-editor-background: #f9f9fa;
    --vscode-editorGutter-background: #f9f9fa;
  }
}
</style>
