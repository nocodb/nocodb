<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import MdiFormatBulletList from '~icons/mdi/format-list-bulleted'
import MdiFormatStrikeThrough from '~icons/mdi/format-strikethrough'
import MdiFormatListNumber from '~icons/mdi/format-list-numbered'
import MdiFormatListCheckbox from '~icons/mdi/format-list-checkbox'
import MsFormatH1 from '~icons/material-symbols/format-h1'
import MsFormatH2 from '~icons/material-symbols/format-h2'
import MsFormatH3 from '~icons/material-symbols/format-h3'
import TablerBlockQuote from '~icons/tabler/blockquote'
import MsCode from '~icons/material-symbols/code'
import MsFormatQuote from '~icons/material-symbols/format-quote'

interface Props {
  editor: Editor
  embedMode?: boolean
}

const props = defineProps<Props>()

const editor = computed(() => props.editor)

const embedMode = computed(() => props.embedMode)

const cmdOrCtrlKey = computed(() => {
  return isMac() ? '⌘' : 'CTRL'
})

const shiftKey = computed(() => {
  return isMac() ? '⇧' : 'Shift'
})

const altKey = computed(() => {
  return isMac() ? '⌥' : 'Alt'
})

const onToggleLink = () => {
  const activeNode = editor.value?.state?.selection?.$from?.nodeBefore || editor.value?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor.value?.state?.storedMarks?.some((mark: any) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: any) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    editor.value!.chain().focus().unsetLink().run()
  } else {
    if (editor.value.state.selection.empty) {
      editor
        .value!.chain()
        .focus()
        .insertContent(' ')
        .setTextSelection({ from: editor.value!.state.selection.$from.pos, to: editor.value!.state.selection.$from.pos + 1 })
        .toggleLink({
          href: '',
        })
        .setTextSelection({ from: editor.value!.state.selection.$from.pos, to: editor.value!.state.selection.$from.pos + 1 })
        .deleteSelection()
        .run()
    } else {
      editor
        .value!.chain()
        .focus()
        .setLink({
          href: '',
        })
        .selectTextblockEnd()
        .run()
    }

    setTimeout(() => {
      const linkInput = document.querySelector('.nc-text-area-rich-link-option-input')
      if (linkInput) {
        ;(linkInput as any).focus()
      }
    }, 100)
  }
}
</script>

<template>
  <div
    class="bubble-menu flex flex-row gap-x-1 bg-gray-100 py-1 rounded-lg px-1"
    :class="{
      'embed-mode': embedMode,
      'full-mode': !embedMode,
    }"
  >
    <NcTooltip :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.bold') }}
          </div>
          <div class="text-xs">{{ cmdOrCtrlKey }} B</div>
        </div>
      </template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('bold') }"
        :disabled="editor.isActive('codeBlock')"
        @click="editor!.chain().focus().toggleBold().run()"
      >
        <MdiFormatBold />
      </NcButton>
    </NcTooltip>

    <NcTooltip :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.italic') }}
          </div>
          <div>{{ cmdOrCtrlKey }} I</div>
        </div>
      </template>
      <NcButton
        size="small"
        type="text"
        :disabled="editor.isActive('codeBlock')"
        :class="{ 'is-active': editor.isActive('italic') }"
        @click=";(editor!.chain().focus() as any).toggleItalic().run()"
      >
        <MdiFormatItalic />
      </NcButton>
    </NcTooltip>
    <NcTooltip :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.underline') }}
          </div>
          <div>{{ cmdOrCtrlKey }} U</div>
        </div>
      </template>

      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('underline') }"
        :disabled="editor.isActive('codeBlock')"
        @click="editor!.chain().focus().toggleUnderline().run()"
      >
        <MdiFormatUnderline />
      </NcButton>
    </NcTooltip>
    <NcTooltip :disabled="editor.isActive('codeBlock')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.strike') }}
          </div>
          <div>{{ shiftKey }} {{ cmdOrCtrlKey }} S</div>
        </div>
      </template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('strike') }"
        :disabled="editor.isActive('codeBlock')"
        @click="editor!.chain().focus().toggleStrike().run()"
      >
        <MdiFormatStrikeThrough />
      </NcButton>
    </NcTooltip>
    <NcTooltip v-if="embedMode">
      <template #title> {{ $t('general.code') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('codeBlock') }"
        @click="editor!.chain().focus().toggleCodeBlock().run()"
      >
        <MsCode />
      </NcButton>
    </NcTooltip>
    <NcTooltip v-else :disabled="editor.isActive('codeBlock')">
      <template #title> {{ $t('general.quote') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('code') }"
        :disabled="editor.isActive('codeBlock')"
        @click="editor!.chain().focus().toggleCode().run()"
      >
        <MsFormatQuote />
      </NcButton>
    </NcTooltip>
    <div class="divider"></div>

    <template v-if="embedMode">
      <NcTooltip>
        <template #title>
          <div class="flex flex-col items-center">
            <div>
              {{ $t('labels.heading1') }}
            </div>
            <div>{{ cmdOrCtrlKey }} {{ altKey }} 1</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
          @click="editor!.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <MsFormatH1 />
        </NcButton>
      </NcTooltip>
      <NcTooltip>
        <template #title>
          <div class="flex flex-col items-center">
            <div>
              {{ $t('labels.heading2') }}
            </div>
            <div>{{ cmdOrCtrlKey }} {{ altKey }} 2</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
          @click="editor!.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <MsFormatH2 />
        </NcButton>
      </NcTooltip>
      <NcTooltip>
        <template #title>
          <div class="flex flex-col items-center">
            <div>
              {{ $t('labels.heading3') }}
            </div>
            <div>{{ cmdOrCtrlKey }} {{ altKey }} 3</div>
          </div>
        </template>
        <NcButton
          size="small"
          type="text"
          :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
          @click="editor!.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <MsFormatH3 />
        </NcButton>
      </NcTooltip>

      <div class="divider"></div>
    </template>

    <NcTooltip v-if="embedMode">
      <template #title> {{ $t('labels.blockQuote') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('blockquote') }"
        @click="editor!.chain().focus().toggleBlockquote().run()"
      >
        <TablerBlockQuote class="-mt-0.25" />
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title> {{ $t('labels.bulletList') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('bulletList') }"
        @click="editor!.chain().focus().toggleBulletList().run()"
      >
        <MdiFormatBulletList />
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title> {{ $t('labels.numberedList') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('orderedList') }"
        @click="editor!.chain().focus().toggleOrderedList().run()"
      >
        <MdiFormatListNumber />
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title> {{ $t('labels.taskList') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('taskList') }"
        @click="editor!.chain().focus().toggleTaskList().run()"
      >
        <MdiFormatListCheckbox />
      </NcButton>
    </NcTooltip>

    <div class="divider"></div>

    <NcTooltip :disabled="editor.isActive('codeBlock')">
      <template #title> {{ $t('general.link') }}</template>
      <NcButton
        size="small"
        type="text"
        :class="{ 'is-active': editor.isActive('link') }"
        :disabled="editor.isActive('codeBlock')"
        @click="onToggleLink"
      >
        <div class="flex flex-row items-center px-0.5">
          <MdiLink />
          <div class="!text-xs !ml-1">{{ $t('general.link') }}</div>
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>

<style lang="scss">
.bubble-menu-hidden {
  [data-tippy-root] {
    opacity: 0;
    height: 0;
    overflow: hidden;
    z-index: -1;
    user-select: none;
  }
}

.bubble-text-format-button-icon {
  @apply px-1.5 py-0 border-1 border-gray-300 rounded-sm items-center justify-center;
  font-size: 0.8rem;
  font-weight: 600;
}
.bubble-text-format-button {
  @apply rounded-md py-1 my-0 pl-2.5 pr-3 cursor-pointer items-center gap-x-2.5 hover:bg-gray-100;
}

.bubble-menu.full-mode {
  @apply border-gray-100
  box-shadow: 0px 0px 1.2rem 0 rgb(230, 230, 230) !important;
}

.bubble-menu.embed-mode {
  @apply border-transparent !shadow-none;
}

.embed-mode.bubble-menu {
  @apply !py-0 !my-0 !border-0;

  .divider {
    @apply my-0 !h-11 border-gray-100;
  }

  .nc-button {
    @apply !mt-1.65;
  }
}

.bubble-menu {
  // shadow
  @apply bg-white;
  border-width: 1px;

  .nc-button.is-active {
    @apply !hover:outline-gray-200 bg-gray-100 text-brand-500;
    outline: 1px;
  }
  .divider {
    @apply border-r-1 border-gray-200 !h-6 !mx-0.5 my-1;
  }
  .ant-select-selector {
    @apply !rounded-md;
  }
  .ant-select-selector .ant-select-selection-item {
    @apply !text-xs;
  }
  .ant-btn-loading-icon {
    @apply pb-0.5;
  }
}
</style>
