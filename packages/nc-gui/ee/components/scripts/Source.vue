<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const props = defineProps<Props>()

// Define Monaco Editor as an async component
const MonacoEditor = defineAsyncComponent(() => import('~/components/monaco/Editor.vue'))

interface Props {
  code: string
}
const code = toRef(props, 'code')

const showCode = ref(true)
</script>

<template>
  <div
    :class="{
      'h-9': !showCode,
      'h-110': showCode,
    }"
    class="nc-script-code-tab-wrapper mt-2"
  >
    <div
      class="flex h-9 bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-medium rounded-t-lg transition-all items-center px-3"
      :class="{
        'rounded-b-lg': !showCode,
      }"
      @click="showCode = !showCode"
    >
      <div class="flex-1 text-nc-content-gray leading-5">View Source</div>
      <GeneralIcon icon="ncChevronDown" class="transition-all" :class="{ 'rotate-180 transform ': showCode }" />
    </div>
    <Transition>
      <Suspense v-if="showCode">
        <template #default>
          <MonacoEditor
            class="h-[402px] !rounded-b-lg overflow-hidden !nc-bg-gray-extralight"
            :model-value="code"
            :read-only="true"
            lang="javascript"
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
        </template>
        <template #fallback>
          <div class="h-[402px] w-full flex items-center justify-center bg-nc-bg-gray-extralight">
            <div class="text-center">
              <a-spin size="large" />
              <div class="mt-4 text-nc-content-gray-subtle2">Loading Monaco Editor...</div>
            </div>
          </div>
        </template>
      </Suspense>
    </Transition>
  </div>
</template>

<style lang="scss">
.nc-script-code-tab-wrapper {
  @apply !bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium rounded-lg;
  .monaco-editor {
    @apply !border-0 !rounded-b-lg pr-3 outline-none;
  }
  .overflow-guard {
    @apply !border-0 !rounded-b-lg !rounded-t-0;
  }
  .monaco-editor,
  .monaco-diff-editor,
  .monaco-component {
    --vscode-editor-background: var(--nc-bg-gray-extra-light);
    --vscode-editorGutter-background: var(--nc-bg-gray-extra-light);
  }
}
</style>
