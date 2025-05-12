<script setup lang="ts">
import { LoadingOutlined } from '@ant-design/icons-vue'

interface Props {
  code: string
}

const props = defineProps<Props>()

const code = toRef(props, 'code')

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const { t } = useI18n()

const { copy } = useCopy()

const isCopied = ref(false)

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
</script>

<template>
  <div class="nc-mcp-code-tab-wrapper h-80 flex flex-col mt-2">
    <div class="flex h-9 bg-gray-50 border-b-1 border-nc-border-gray-medium rounded-t-lg items-center px-3">
      <div class="flex-1 text-nc-content-gray leading-5">JSON</div>
      <NcButton type="text" size="small" class="!hover:bg-gray-200" @click="onCopyToClipboard">
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
    </div>
    <Suspense>
      <MonacoEditor
        class="h-72 !rounded-b-lg overflow-hidden !bg-gray-50"
        :model-value="code"
        :read-only="true"
        lang="json"
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
          renderIndentGuides: false,
          wrappingStrategy: 'advanced',
          renderLineHighlight: 'none',
          tabSize: 2,
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
</template>

<style lang="scss">
.nc-mcp-code-tab-wrapper {
  @apply !bg-nc-bg-gray-extra-light border-1 border-nc-border-gray-medium rounded-lg flex-1;

  .monaco-editor {
    @apply !border-0 !rounded-b-lg pr-3;
  }
  .overflow-guard {
    @apply !border-0 !rounded-b-lg;
  }
  .monaco-editor,
  .monaco-diff-editor,
  .monaco-component {
    --vscode-editor-background: #f9f9fa;
    --vscode-editorGutter-background: #f9f9fa;
  }
}
</style>
