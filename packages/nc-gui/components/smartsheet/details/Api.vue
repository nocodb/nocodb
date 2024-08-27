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

const isCopied = ref(false)

const langs = [
  {
    name: 'shell',
    clients: ['curl', 'wget'],
    icon: iconMap.langShell,
  },
  {
    name: 'javascript',
    clients: ['axios', 'fetch', 'jquery', 'xhr'],
    icon: iconMap.langJavascript,
  },
  {
    name: 'node',
    clients: ['axios', 'fetch', 'request', 'native', 'unirest'],
    icon: iconMap.langNode,
  },
  {
    name: 'NocoDB-SDK',
    clients: ['javascript', 'node'],
    icon: iconMap.langNocodbSdk,
  },
  {
    name: 'php',
    icon: iconMap.langPhp,
  },
  {
    name: 'python',
    clients: ['python3', 'requests'],
    icon: iconMap.langPython,
  },
  {
    name: 'ruby',
    icon: iconMap.langRuby,
  },
  {
    name: 'java',
    icon: iconMap.langJava,
  },
  {
    name: 'c',
    icon: iconMap.langC,
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
  if (activeLang.value?.name === 'NocoDB-SDK') {
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

    isCopied.value = true

    setTimeout(() => {
      isCopied.value = false
    }, 5000)
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
    href: 'https://data-apis-v2.nocodb.com/',
  },
  {
    title: 'Meta APIs',
    href: 'https://meta-apis-v2.nocodb.com/',
  },
  {
    title: 'Create API Token',
    href: 'https://docs.nocodb.com/account-settings/api-tokens/#create-api-token',
  },
  {
    title: 'Swagger',
    href: 'https://docs.nocodb.com/bases/actions-on-base/#rest-apis',
  },
] as {
  title: string
  href: string
}[]
</script>

<template>
  <div
    class="p-6"
    :style="{
      height: 'calc(100vh - var(--topbar-height) - var(--toolbar-height) - 16px)',
      maxHeight: 'calc(100vh - var(--topbar-height) - var(--toolbar-height) - 16px)',
    }"
  >
    <div class="flex gap-4 max-w-[1000px] mx-auto h-full">
      <NcMenu class="nc-api-snippets-menu !h-full w-[252px] min-w-[252px] nc-scrollbar-thin !pr-3">
        <div
          class="p-2 text-xs text-gray-500 uppercase font-semibold"
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
            <component :is="item.icon" class="!stroke-transparent h-5 w-5" />
            {{ item.name }}
          </div>
        </NcMenuItem>

        <NcDivider class="!my-3" />

        <div class="flex flex-col gap-1">
          <div
            class="p-2 text-xs text-gray-500 uppercase font-semibold"
            :style="{
              letterSpacing: '0.3px',
            }"
          >
            {{ $t('labels.documentation') }}
          </div>

          <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-2 px-2 h-7">
            <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-600" />

            <a
              :href="doc.href"
              target="_blank"
              rel="noopener noreferrer"
              class="!text-gray-700 text-small leading-[18px] !no-underline !hover:underline"
            >
              {{ doc.title }}
            </a>
          </div>
        </div>
      </NcMenu>
      <div class="w-[calc(100%_-_264px)] flex flex-col gap-6 h-full max-h-full">
        <div class="nc-api-clents-tab-wrapper h-[calc(100%_-_56px)] flex flex-col mt-2">
          <NcTabs v-model:activeKey="selectedClient" class="nc-api-clents-tab">
            <template #rightExtra>
              <NcButton
                v-e="[
                  'c:snippet:copy',
                  { client: activeLang?.clients && (selectedClient || activeLang?.clients[0]), lang: activeLang?.name },
                ]"
                type="text"
                size="small"
                class="!hover:bg-gray-200"
                @click="onCopyToClipboard"
              >
                <div class="flex items-center gap-2 text-small leading-[18px] min-w-80px justify-center">
                  <GeneralIcon
                    :icon="isCopied ? 'circleCheck' : 'copy'"
                    class="h-4 w-4"
                    :class="{
                      'text-gray-700': !isCopied,
                      'text-green-700': isCopied,
                    }"
                  />
                  {{ isCopied ? $t('general.copied') : $t('general.copy') }}
                </div>
              </NcButton>
            </template>

            <a-tab-pane v-for="client in activeLang?.clients || ['default']" :key="client" class="!h-full">
              <template #tab>
                <div class="text-small leading-[18px] capitalize select-none">
                  {{ client }}
                </div>
              </template>
              <div></div>
            </a-tab-pane>
          </NcTabs>
          <Suspense>
            <MonacoEditor
              class="h-[calc(100%_-_36px)] !bg-gray-50 pl-2"
              :model-value="code"
              :read-only="true"
              lang="typescript"
              :validate="false"
              :disable-deep-compare="true"
              :monaco-config="{
                minimap: {
                  enabled: false,
                },
                fontSize: 13,
                lineHeight: 18,
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
                detectIndentation: false,
                insertSpaces: true,
                lineNumbers: 'off',
              }"
              hide-minimap
            />
            <template #fallback>
              <div class="h-full w-full flex flex-col justify-center items-center mt-28">
                <a-spin size="large" :indicator="indicator" />
              </div>
            </template>
          </Suspense>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-api-snippets-menu {
  @apply border-r-0 !py-0;

  :deep(.ant-menu-item) {
    @apply h-7 leading-5 my-1.5 px-2 text-gray-700 flex items-center;

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
  .ant-tabs-nav {
    @apply px-3;

    .ant-tabs-tab {
      @apply px-3 pt-2 pb-2.5;
      & + .ant-tabs-tab {
        @apply !ml-2;
      }

      &.ant-tabs-tab-active {
        @apply font-semibold;
      }
    }
  }
  .ant-tabs-content {
    @apply h-full;
  }
}
</style>

<style lang="scss">
.nc-api-clents-tab-wrapper {
  @apply bg-gray-50 border-1 border-gray-200 rounded-lg flex-1;

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
