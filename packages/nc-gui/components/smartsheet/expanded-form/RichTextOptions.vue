<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'

interface Props {
  editor: Editor | undefined
}
const props = withDefaults(defineProps<Props>(), {})

const { appInfo } = useGlobal()

const { editor } = toRefs(props)

const cmdOrCtrlKey = computed(() => {
  return isMac() ? '⌘' : 'CTRL'
})

const shiftKey = computed(() => {
  return isMac() ? '⇧' : 'Shift'
})

const tabIndex = computed(() => {
  return -1
})

const onToggleLink = () => {
  if (!editor.value) return

  const activeNode = editor.value?.state?.selection?.$from?.nodeBefore || editor.value?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor.value?.state?.storedMarks?.some((mark: any) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: any) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    editor.value.chain().focus().unsetLink().run()
  } else {
    if (editor.value?.state.selection.empty) {
      editor
        .value!.chain()
        .focus()
        .insertContent(' ')
        .setTextSelection({ from: editor.value?.state.selection.$from.pos, to: editor.value.state.selection.$from.pos + 1 })
        .toggleLink({
          href: '',
        })
        .setTextSelection({ from: editor.value?.state.selection.$from.pos, to: editor.value.state.selection.$from.pos + 1 })
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

const newMentionNode = () => {
  if (!editor.value) return

  const lastCharacter = editor.value.state.doc.textBetween(
    editor.value.state.selection.$from.pos - 1,
    editor.value.state.selection.$from.pos,
  )

  if (lastCharacter === '@') {
    editor.value
      .chain()
      .deleteRange({ from: editor.value.state.selection.$from.pos - 1, to: editor.value.state.selection.$from.pos })
      .run()
  } else if (lastCharacter !== ' ') {
    editor.value?.commands.insertContent(' @')
    editor.value?.chain().focus().run()
  } else {
    editor.value?.commands.insertContent('@')
    editor.value?.chain().focus().run()
  }
}
</script>

<template>
  <div class="comment-bubble-menu bg-transparent flex-row rounded-lg flex">
    <NcTooltip>
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.bold') }}
          </div>
          <div class="text-xs">{{ cmdOrCtrlKey }} B</div>
        </div>
      </template>
      <NcButton
        :class="{ 'is-active': editor?.isActive('bold') }"
        :tabindex="tabIndex"
        class="!h-7 !w-7 !hover:bg-gray-200"
        size="xsmall"
        type="text"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <GeneralIcon icon="bold" />
      </NcButton>
    </NcTooltip>

    <NcTooltip :disabled="editor?.isActive('italic')">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.italic') }}
          </div>
          <div>{{ cmdOrCtrlKey }} I</div>
        </div>
      </template>
      <NcButton
        :class="{ 'is-active': editor?.isActive('italic') }"
        :tabindex="tabIndex"
        class="!h-7 !w-7 !hover:bg-gray-200"
        size="xsmall"
        type="text"
        @click=";(editor?.chain().focus() as any).toggleItalic().run()"
      >
        <GeneralIcon icon="italic" />
      </NcButton>
    </NcTooltip>
    <NcTooltip>
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.underline') }}
          </div>
          <div>{{ cmdOrCtrlKey }} U</div>
        </div>
      </template>

      <NcButton
        :class="{ 'is-active': editor?.isActive('underline') }"
        :tabindex="tabIndex"
        class="!h-7 !w-7 !hover:bg-gray-200"
        size="xsmall"
        type="text"
        @click="editor?.chain().focus().toggleUnderline().run()"
      >
        <GeneralIcon icon="underline" />
      </NcButton>
    </NcTooltip>
    <NcTooltip>
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.strike') }}
          </div>
          <div>{{ shiftKey }} {{ cmdOrCtrlKey }} S</div>
        </div>
      </template>
      <NcButton
        :class="{ 'is-active': editor?.isActive('strike') }"
        :tabindex="tabIndex"
        class="!h-7 !w-7 !hover:bg-gray-200"
        size="xsmall"
        type="text"
        @click="editor?.chain().focus().toggleStrike().run()"
      >
        <GeneralIcon icon="strike" />
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title> {{ $t('general.link') }}</template>
      <NcButton
        :class="{ 'is-active': editor?.isActive('link') }"
        :tabindex="tabIndex"
        class="!h-7 !w-7 !hover:bg-gray-200"
        size="xsmall"
        type="text"
        @click="onToggleLink"
      >
        <GeneralIcon icon="link2"></GeneralIcon>
      </NcButton>
    </NcTooltip>
    <NcTooltip v-if="appInfo.ee">
      <template #title>
        <div class="flex flex-col items-center">
          <div>
            {{ $t('labels.mention') }}
          </div>
          <div>@</div>
        </div>
      </template>
      <NcButton
        :class="{ 'is-active': editor?.isActive('suggestions') }"
        :tabindex="tabIndex"
        class="!h-7 !w-7 !hover:bg-gray-200"
        size="xsmall"
        type="text"
        @click="newMentionNode"
      >
        <GeneralIcon icon="atSign" />
      </NcButton>
    </NcTooltip>
  </div>
</template>

<style lang="scss" scoped>
.comment-bubble-menu {
  @apply !border-none;

  .nc-button.is-active {
    @apply text-brand-500;
    outline: 1px;
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
